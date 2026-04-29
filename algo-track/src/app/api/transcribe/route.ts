import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GROQ_API_KEY is not configured" },
                { status: 500 },
            );
        }

        const formData = await req.formData();
        const audioFile = formData.get("audio") as File | null;

        if (!audioFile) {
            return NextResponse.json(
                { error: "No audio file provided" },
                { status: 400 },
            );
        }

        // Forward to Groq Whisper API
        const whisperForm = new FormData();
        whisperForm.append("file", audioFile, "recording.webm");
        whisperForm.append("model", "whisper-large-v3");
        whisperForm.append("language", "en");
        whisperForm.append("response_format", "json");

        const groqRes = await fetch(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                body: whisperForm,
            },
        );

        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error("Groq Whisper error:", errBody);
            return NextResponse.json(
                { error: "Transcription failed" },
                { status: 502 },
            );
        }

        const data = await groqRes.json();
        return NextResponse.json({ transcript: data.text || "" });
    } catch (err) {
        console.error("Transcribe error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
