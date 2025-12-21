import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    // 🔧 FIXED: Replace the broken JSON parsing with robust parsing
    // Get raw body text first
    const rawText = await request.text();
    console.log("Received raw request body:", rawText);

    // Clean the text - find actual JSON content
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      console.error("No JSON object found in request");
      return NextResponse.json(["Error: Request must contain a JSON object"], {
        status: 400
      });
    }

    // Extract just the JSON part
    const jsonText = rawText.substring(firstBrace, lastBrace + 1);
    console.log("Extracted JSON text:", jsonText);

    // Parse the JSON
    let parsedBody;
    try {
      parsedBody = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError.message);
      return NextResponse.json([`Error: Invalid JSON format - ${parseError.message}`], {
        status: 400
      });
    }

    // Extract parameters with defaults
    const {
      type = "technical",
      role = "Software Engineer",
      level = "mid",
      techstack = "",
      amount = "5",
      userid = "anonymous"
    } = parsedBody;

    // Build the prompt for Hugging Face
    const prompt = `Prepare questions for a job interview.
      The job role is ${role}.
      The job experience level is ${level}.
      The tech stack used in the job is: ${techstack}.
      The focus between behavioural and technical questions should lean towards: ${type}.
      The amount of questions required is: ${amount}.
      Please return only the questions, without any additional text.
      The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
      Return the questions formatted like this:
      ["Question 1", "Question 2", "Question 3"]

      Thank you! <3`;

    const apiKey = process.env.HUGGINGFACE_API_KEY!;
    const targetModel = "HuggingFaceTB/SmolLM3-3B";

    // Direct call to Hugging Face router endpoint
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            {
              "role": "user",
              "content": prompt
            }
          ],
          max_tokens: 500,
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || "No response generated";

    // Parse the questions (should be in array format)
    let questionsArray;
    try {
      questionsArray = JSON.parse(generatedText);
    } catch (parseError) {
      const match = generatedText.match(/\[.*\]/s);
      if (match) {
        questionsArray = JSON.parse(match[0]);
      } else {
        questionsArray = generatedText
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => line.replace(/^[\d\-\.\s]+/, '').trim());
      }
    }

    // ✅ FINAL FIX: Clean the questions array - remove <think> tags and reasoning text
    const cleanQuestionsArray = questionsArray.filter(item => {
      const lowerItem = item.toLowerCase();
      return (
        item !== "<think>" &&
        item !== "</think>" &&
        !lowerItem.includes("okay, let's see") &&
        !lowerItem.includes("first, for technical questions") &&
        !lowerItem.includes("behavioral questions are about") &&
        !lowerItem.includes("since it's entry-level") &&
        !lowerItem.includes("i need to make sure") &&
        !lowerItem.includes("let me draft them") &&
        !lowerItem.includes("that should cover the mix") &&
        !lowerItem.includes("alright, that should work")
      );
    });

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: typeof techstack === 'string' ? techstack.split(",").map((t: string) => t.trim()) : techstack,
      questions: cleanQuestionsArray, // Save clean questions to Firebase
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    console.log("API Success: Clean questions ready for Vapi:", cleanQuestionsArray);

    // ✅ FINAL FIX: Return ONLY the clean questions array as the response
    // This makes the entire HTTP response body be the tool's result
    return NextResponse.json(cleanQuestionsArray, {
      status: 200
    });

  } catch (error: any) {
    console.error("Error:", error);

    // Return a simple error array for consistency
    return NextResponse.json([`Error: ${error.message}`], {
      status: 500
    });
  }
}

export async function GET() {
  // Return a simple array for GET requests too
  return NextResponse.json(["API is operational"], {
    status: 200
  });
}