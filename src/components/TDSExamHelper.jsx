import React, { useState } from "react";
import {
  CheckCircle,
  AlertCircle,
  Loader,
  Target,
} from "lucide-react";

export default function TDSExamHelper() {
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState([]);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ---- handle file selection / removal ----
  const handleFileChange = (e) => setFiles(Array.from(e.target.files));
  const removeFile = (i) => setFiles(files.filter((_, idx) => idx !== i));

  // ---- smart file reader ----
  const readFileSmart = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      const type = file.type || "";
      reader.onload = () => {
        let content = "";
        if (type.includes("text") || type.includes("csv") || type.includes("json"))
          content = reader.result.slice(0, 100000);
        else if (type.includes("pdf") || type.includes("image"))
          content = `[Base64 ${type.split("/")[1]} file, ${(file.size / 1024).toFixed(0)} KB]`;
        else content = `[Unsupported file ${file.name}, ${(file.size / 1024).toFixed(0)} KB]`;
        resolve({ name: file.name, type, content });
      };
      if (type.includes("text") || type.includes("csv") || type.includes("json"))
        reader.readAsText(file);
      else reader.readAsDataURL(file);
    });

  // ---- GPT-5 call ----
  const callGPT = async (prompt) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing VITE_OPENAI_API_KEY in .env");

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5",
        input: prompt,
        temperature: 0.4,
        max_output_tokens: 4000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json();
    return (
      data.output_text ||
      (data.output || [])
        .map((o) =>
          Array.isArray(o.content)
            ? o.content.map((c) => c.text || "").join("\n")
            : o.text || ""
        )
        .join("\n")
    );
  };

  // ---- handle submit ----
  const handleSubmit = async () => {
    if (!question.trim() && files.length === 0) {
      setError("Please enter a question and/or upload at least one file.");
      return;
    }
    setLoading(true);
    setError("");
    setResponseText("");

    try {
      const fileData = await Promise.all(files.map(readFileSmart));
      const fileSummary = fileData
        .map(
          (f) =>
            `\n\nFile: ${f.name}\nType: ${f.type}\nContent Preview:\n${f.content}`
        )
        .join("\n");

      // 🔹 The core prompt that tells GPT-5 what to do:
      const prompt = `
You are an expert assistant for Tools and Data Science.
The user will provide files and a task. Perform the task using the file contents if relevant.

QUESTION/TASK:
${question}

UPLOADED FILES:
${fileSummary}

Please return a single, complete result.
Format:
**FINAL ANSWER:** [result]
Confidence: [High/Medium/Low]
      `.trim();

      const result = await callGPT(prompt);
      setResponseText(result);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- render ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <h1 className="text-3xl font-bold">🧠 TDS Exam Helper (GPT-5)</h1>
          <p className="text-blue-100 text-sm">
            Ask a question and upload files — GPT-5 will perform the requested action on them.
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Question */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Question / Task
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Example: 'Summarize this PDF' or 'Extract column names from this CSV'"
              className="w-full h-32 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 resize-none"
              disabled={loading}
            />
          </div>

          {/* Files */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Upload Files (any type)
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={loading}
              className="block w-full text-sm text-gray-700 border-2 border-gray-300 rounded-lg cursor-pointer focus:border-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-gray-50 p-2 rounded-md border border-gray-200"
                  >
                    <div>
                      <span className="font-medium text-gray-800 text-sm">
                        {f.name}
                      </span>{" "}
                      <span className="text-xs text-gray-500">
                        ({(f.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-red-500 text-sm hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Analyzing with GPT-5...</span>
              </>
            ) : (
              <>
                <Target size={20} />
                <span>Run Task</span>
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start space-x-3">
              <AlertCircle className="text-red-500 mt-0.5" size={20} />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Output */}
          {responseText && (
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 whitespace-pre-wrap">
              <h3 className="font-semibold text-gray-700 mb-2 flex items-center">
                <CheckCircle className="text-green-600 mr-2" size={18} />
                GPT-5 Response
              </h3>
              <p className="text-gray-800 text-sm">{responseText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
