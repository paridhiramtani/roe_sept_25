import React, { useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  Loader,
  RefreshCw,
  Target,
} from "lucide-react";

export default function TDSExamHelper() {
  const [question, setQuestion] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [numAttempts, setNumAttempts] = useState(3);

  const systemPrompt = `You are an expert in Tools and Data Science (TDS) with deep knowledge in:

**Development Environments & Tools**
- VS Code, uv, npx, Bash, Git, curl, Postman
- GitHub, DevTools, Docker, Codespaces, etc.

**AI & Data Tools**
- FastAPI, dbt, DuckDB, SQLite, Excel, OpenRefine
- RAG, embeddings, LLM pipelines, vector databases

**Instructions**
1. Provide COMPLETE, WORKING solutions (code, commands, configs)
2. Be precise: use correct syntax and tested examples
3. Confidence level at end of answer
4. Avoid vague suggestions
5. Format: 
   - Context (if needed)
   - **FINAL ANSWER:** [solution]
   - Confidence: [High/Medium/Low]
`;

  // Helper: Extract GPT-5 response text
  const extractResponseText = (data) => {
    if (typeof data?.output_text === "string" && data.output_text.trim()) {
      return data.output_text;
    }
    if (Array.isArray(data?.output)) {
      const textParts = [];
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c?.type === "output_text") textParts.push(c.text);
          }
        } else if (item?.text) textParts.push(item.text);
      }
      if (textParts.length) return textParts.join("\n");
    }
    if (Array.isArray(data?.choices)) {
      return data.choices.map((c) => c.message?.content || "").join("\n");
    }
    return "";
  };

  // OpenAI GPT-5 API call
  const callAPI = async (attemptNum) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing VITE_OPENAI_API_KEY in .env");

    const body = {
      model: "gpt-5",
      input: `${systemPrompt}\n\nQUESTION:\n${question}\n\n${
        attemptNum > 1
          ? "IMPORTANT: Double-check logic before finalizing answer."
          : ""
      }`,
      temperature: attemptNum === 1 ? 0.3 : 0.5,
      max_output_tokens: 4000,
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return extractResponseText(data);
  };

  const parseAnswer = (text) => {
    if (!text) return { analysis: "", answer: "", confidence: "" };

    const finalMatch = text.match(
      /\*\*FINAL ANSWER:\*\*\s*(.+?)(?=\n\n|Confidence:|$)/is
    );
    const confidenceMatch = text.match(/Confidence:\s*(.+?)(?=\n|$)/i);
    let analysis = text;
    if (finalMatch) analysis = text.substring(0, finalMatch.index);

    return {
      analysis: analysis.trim(),
      answer: finalMatch ? finalMatch[1].trim() : "",
      confidence: confidenceMatch ? confidenceMatch[1].trim() : "",
      fullText: text,
    };
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    setLoading(true);
    setError("");
    setAttempts([]);

    try {
      const results = [];

      for (let i = 1; i <= numAttempts; i++) {
        const responseText = await callAPI(i);
        const parsed = parseAnswer(responseText);
        results.push({ attemptNum: i, response: responseText, parsed });
        setAttempts([...results]);
        if (i < numAttempts) await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err) {
      console.error("API Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const findConsensus = () => {
    if (attempts.length === 0) return null;
    const counts = {};
    for (const a of attempts) {
      const key = a.parsed.answer.toLowerCase().slice(0, 100);
      counts[key] = counts[key] ? [...counts[key], a] : [a];
    }
    let best = null;
    let max = 0;
    for (const group of Object.values(counts)) {
      if (group.length > max) {
        max = group.length;
        best = group[0];
      }
    }
    return {
      answer: best,
      agreement: max,
      total: attempts.length,
      isConsensus: max >= Math.ceil(attempts.length / 2),
    };
  };

  const consensus = findConsensus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">
              🧠 TDS Exam Answer Generator (GPT-5)
            </h1>
            <p className="text-blue-100">
              Multi-attempt reasoning system for maximum accuracy
            </p>
          </div>

          {/* Input Section */}
          <div className="p-6 space-y-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Paste your exam question here..."
              className="w-full h-40 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              disabled={loading}
            />

            <div className="flex items-center space-x-4">
              <label className="text-sm font-semibold text-gray-700">
                Attempts:
              </label>
              <select
                value={numAttempts}
                onChange={(e) => setNumAttempts(Number(e.target.value))}
                disabled={loading}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500"
              >
                <option value={2}>2 (Fast)</option>
                <option value={3}>3 (Balanced)</option>
                <option value={5}>5 (Most Accurate)</option>
              </select>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>
                    Analyzing... ({attempts.length}/{numAttempts})
                  </span>
                </>
              ) : (
                <>
                  <Target size={20} />
                  <span>Get Verified Answer</span>
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start space-x-3">
                <AlertCircle className="text-red-500 mt-0.5" size={20} />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {consensus && consensus.answer && (
              <div className="mt-6 space-y-4">
                <div
                  className={`p-6 rounded-lg border-2 ${
                    consensus.isConsensus
                      ? "bg-green-50 border-green-500"
                      : "bg-yellow-50 border-yellow-500"
                  }`}
                >
                  <div className="flex items-start space-x-3 mb-4">
                    {consensus.isConsensus ? (
                      <CheckCircle
                        className="text-green-600 flex-shrink-0 mt-1"
                        size={24}
                      />
                    ) : (
                      <AlertCircle
                        className="text-yellow-600 flex-shrink-0 mt-1"
                        size={24}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h3
                          className={`font-bold text-lg ${
                            consensus.isConsensus
                              ? "text-green-900"
                              : "text-yellow-900"
                          }`}
                        >
                          {consensus.isConsensus
                            ? "✅ CONSENSUS ANSWER"
                            : "⚠️ BEST ANSWER (Partial Agreement)"}
                        </h3>
                        <span
                          className={`text-sm px-3 py-1 rounded-full ${
                            consensus.isConsensus
                              ? "bg-green-600 text-white"
                              : "bg-yellow-600 text-white"
                          }`}
                        >
                          {consensus.agreement}/{consensus.total} agree
                        </span>
                      </div>
                      <p
                        className={`text-xl font-semibold ${
                          consensus.isConsensus
                            ? "text-green-900"
                            : "text-yellow-900"
                        }`}
                      >
                        {consensus.answer.parsed.answer}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Attempts */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <RefreshCw size={18} className="mr-2" />
                    All Attempts ({attempts.length})
                  </h3>
                  {attempts.map((a) => (
                    <details
                      key={a.attemptNum}
                      className="bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <summary className="cursor-pointer p-4 hover:bg-gray-100 font-medium text-gray-700">
                        Attempt {a.attemptNum} — Confidence:{" "}
                        {a.parsed.confidence || "Not specified"}
                      </summary>
                      <div className="p-4 border-t border-gray-200 space-y-3">
                        {a.parsed.analysis && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">
                              Analysis:
                            </h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {a.parsed.analysis}
                            </p>
                          </div>
                        )}
                        <div className="bg-white p-3 rounded border border-gray-300">
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">
                            Answer:
                          </h4>
                          <p className="text-gray-900 font-mono text-sm whitespace-pre-wrap">
                            {a.parsed.answer}
                          </p>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">💡 How It Works</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Calls GPT-5 multiple times for the same question</li>
              <li>• Detects when answers agree for higher confidence</li>
              <li>• ✅ Green box = consensus reached</li>
              <li>• ⚠️ Yellow box = mixed answers, check details</li>
              <li>• Recommended: 3-5 attempts for best reliability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
