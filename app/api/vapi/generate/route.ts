import { NextRequest, NextResponse } from "next/server";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    console.log("Received raw request body:", rawText);

    let parsedBody;
    try {
      parsedBody = JSON.parse(rawText);
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError.message);
      console.error("Raw text that failed:", rawText);
      return NextResponse.json([`Error: Invalid JSON - ${parseError.message}`], {
        status: 400
      });
    }

    const {
      type = "technical",
      role = "Software Engineer",
      level = "mid",
      techstack = "",
      amount = "5",
      userid = "anonymous"
    } = parsedBody;

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

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY!;

    // Gemini Flash API call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.9,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";

    console.log("Raw AI response:", generatedText);

    let questionsArray = [];

    const arrayMatch = generatedText.match(/\[\s*["'][^\[\]]*["'](?:\s*,\s*["'][^\[\]]*["'])*\s*\]/s);

    if (arrayMatch) {
      try {
        questionsArray = JSON.parse(arrayMatch[0]);
        console.log("Found array via regex:", questionsArray);
      } catch (parseError) {
        console.log("Regex match found but failed to parse:", arrayMatch[0]);
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

    if (questionsArray.length === 0) {
      console.log("No array found, extracting from text...");

      const questionPatterns = [
        /["']([^"']+\?)["']/g,
        /\d+\.\s*([^\n]+\?)/g,
        /-\s*([^\n]+\?)/g,
        /\*\s*([^\n]+\?)/g,
        /([A-Z][^.!?]*\?)/g
      ];

      for (const pattern of questionPatterns) {
        const matches = generatedText.match(pattern);
        if (matches && matches.length > 0) {
          questionsArray = matches.map(match => {
            return match
              .replace(/^["'\d\-\.\*\s]+/, '')
              .replace(/["']$/g, '')
              .trim();
          }).filter(q => q.length > 10);

          if (questionsArray.length > 0) {
            console.log(`Found ${questionsArray.length} questions with pattern`);
            break;
          }
        }
      }
    }

    const cleanQuestionsArray = questionsArray
      .filter(item => {
        if (!item || typeof item !== 'string') return false;
        const lowerItem = item.toLowerCase();
        return (
          item.length > 10 &&
          item.includes('?') &&
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
      .slice(0, parseInt(amount) || 5);

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

    let finalResponse;
    if (Array.isArray(cleanQuestionsArray)) {
      finalResponse = cleanQuestionsArray;
    } else {
      console.warn("WARNING: cleanQuestionsArray is not an array! Converting to array.");
      finalResponse = [String(cleanQuestionsArray)];
    }

    return NextResponse.json(finalResponse, {
      status: 200
    });

  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json([`Error: ${error.message}`], {
      status: 500
    });
  }
}

export async function GET() {
  return NextResponse.json(["API is operational"], {
    status: 200
  });
}