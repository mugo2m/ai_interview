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

    // 🔧 UPDATED: Better prompt for Hugging Face
    const prompt = `You are a job interview question generator. Generate exactly ${amount} questions for a ${role} position.
Experience level: ${level}
Tech stack: ${techstack}
Question type: ${type}

CRITICAL INSTRUCTIONS:
1. Return ONLY a JSON array of questions, nothing else
2. Do not include any explanations, thinking, or additional text
3. Format strictly as: ["Question 1 text here?", "Question 2 text here?", "Question 3 text here?"]
4. Questions should be clear and concise for a voice assistant to read
5. No special characters like / or * that might break voice synthesis

Example response for Data Scientist with SQL/R:
["How do you optimize SQL queries for large datasets?", "Describe your experience with data visualization in R.", "Tell me about a time you had to explain complex data insights to non-technical stakeholders?"]

Now generate ${amount} ${type} questions for ${role} with ${techstack}:`;

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
          temperature: 0.7, // Added for better creativity control
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || "No response generated";

    console.log("Raw AI response:", generatedText);

    // 🔧 IMPROVED: Better question parsing
    let questionsArray = [];

    // Try to extract JSON array with more flexible matching
    const arrayMatch = generatedText.match(/\[\s*["'][^\[\]]*["'](?:\s*,\s*["'][^\[\]]*["'])*\s*\]/s);

    if (arrayMatch) {
      try {
        questionsArray = JSON.parse(arrayMatch[0]);
        console.log("Found array via regex:", questionsArray);
      } catch (parseError) {
        console.log("Regex match found but failed to parse:", arrayMatch[0]);
        // Try cleaning the matched text
        try {
          const cleanMatch = arrayMatch[0]
            .replace(/[\n\r]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          questionsArray = JSON.parse(cleanMatch);
        } catch (cleanError) {
          console.log("Failed to parse even after cleaning");
        }
      }
    }

    // If no array found, try to extract questions from text
    if (questionsArray.length === 0) {
      console.log("No array found, extracting from text...");

      // Look for question patterns in the text
      const questionPatterns = [
        /["']([^"']+\?)["']/g,  // Text in quotes ending with ?
        /\d+\.\s*([^\n]+\?)/g,   // Numbered questions: 1. Question?
        /-\s*([^\n]+\?)/g,       // Bullet questions: - Question?
        /\*\s*([^\n]+\?)/g,      // Star questions: * Question?
        /([A-Z][^.!?]*\?)/g      // Any sentence ending with ?
      ];

      for (const pattern of questionPatterns) {
        const matches = generatedText.match(pattern);
        if (matches && matches.length > 0) {
          questionsArray = matches.map(match => {
            // Clean up the match
            return match
              .replace(/^["'\d\-\.\*\s]+/, '')  // Remove quotes, numbers, bullets
              .replace(/["']$/g, '')           // Remove trailing quotes
              .trim();
          }).filter(q => q.length > 10); // Filter out very short strings

          if (questionsArray.length > 0) {
            console.log(`Found ${questionsArray.length} questions with pattern`);
            break;
          }
        }
      }
    }

    // 🔧 UPDATED: Better cleaning filter
    const cleanQuestionsArray = questionsArray
      .filter(item => {
        if (!item || typeof item !== 'string') return false;
        const lowerItem = item.toLowerCase();
        return (
          item.length > 10 && // Reasonable question length
          item.includes('?') && // Should be a question
          !lowerItem.includes('<think>') &&
          !lowerItem.includes('</think>') &&
          !lowerItem.includes('okay') &&
          !lowerItem.includes('let me') &&
          !lowerItem.includes('first') &&
          !lowerItem.includes('second') &&
          !lowerItem.includes('third') &&
          !lowerItem.includes('behavioral questions') &&
          !lowerItem.includes('technical questions') &&
          !lowerItem.includes('example response') &&
          !lowerItem.includes('generate') &&
          !lowerItem.includes('instructions')
        );
      })
      .slice(0, parseInt(amount) || 5); // Limit to requested amount

    // Ensure we have at least SOME questions
    if (cleanQuestionsArray.length === 0) {
      console.log("No questions extracted, using fallback questions");
      const fallbackQuestions = [
        `Tell me about your experience with ${role} roles.`,
        `How do you approach problem-solving in your work?`,
        `What are your strengths when working with ${techstack || 'technology'}?`,
        `Describe a challenging project you worked on.`,
        `How do you stay updated with industry trends?`
      ];
      cleanQuestionsArray.push(...fallbackQuestions.slice(0, parseInt(amount) || 3));
    }

    console.log("Final clean questions:", cleanQuestionsArray);

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: typeof techstack === 'string' ? techstack.split(",").map((t: string) => t.trim()) : techstack,
      questions: cleanQuestionsArray,
      userId: userid,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    console.log("API Success: Clean questions ready for Vapi:", cleanQuestionsArray);

    // ✅ FINAL FIX: Return ONLY the clean questions array as the response
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