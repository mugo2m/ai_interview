import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { type, role, level, techstack, amount, userid } = await request.json();

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

    // 🚨 FIX 1: Use HUGGINGFACE_API_KEY, not Google key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;
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

    // Parse the questions
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

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: typeof techstack === 'string' ? techstack.split(",").map((t: string) => t.trim()) : techstack,
      questions: questionsArray,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    // 🚨 FIX 2: Vapi REQUIRES "output" field with stringified data
    const vapiResponse = {
      output: JSON.stringify({
        success: true,
        questions: questionsArray,
        count: questionsArray.length,
        role: role,
        level: level,
        techstack: techstack,
        type: type,
        userid: userid,
        message: `Generated ${questionsArray.length} questions for ${role} position`
      })
    };

    console.log("Sending Vapi response:", vapiResponse);

    return NextResponse.json(vapiResponse, { status: 200 });

  } catch (error: any) {
    console.error("Error:", error);

    // Even errors need Vapi format
    return NextResponse.json({
      output: JSON.stringify({
        success: false,
        error: error.message || "Internal server error"
      })
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    output: JSON.stringify({
      success: true,
      data: "Thank you!",
      message: "API is working"
    })
  }, { status: 200 });
}