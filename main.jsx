import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, Loader, RefreshCw, Target } from 'lucide-react';

export default function TDSExamHelper() {
  const [question, setQuestion] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [numAttempts, setNumAttempts] = useState(3);

  const systemPrompt = `You are an expert in Tools and Data Science (TDS) with deep knowledge in:
  
**(keep your full original system prompt here)**

CRITICAL INSTRUCTIONS:
1. These are practical, hands-on questions - provide COMPLETE, WORKING solutions
...
Confidence: [High/Medium/Low]`;

  // Helper: safely extract textual output from OpenAI Responses API
  const extractResponseText = (data) => {
    try {
      // 1) newer Responses API often provides `output_text` convenience field
      if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text;
      }

      // 2) Fallback: iterate output[] items and collect content pieces
      if (Array.isArray(data?.output)) {
        const pieces = [];
        for (const item of data.output) {
          // 'content' can be an array of content objects
          const contents = item?.content ?? [];
          for (const c of contents) {
            // Many responses include { type: 'output_text', text: '...' }
            if (c?.type === 'output_text' && typeof c?.text === 'string') {
              pieces.push(c.text);
            }
            // Or items with { type: 'message', author:..., content: [...] }
            if (c?.type === 'message' && Array.isArray(c.content)) {
              for (const m of c.content) {
                if (m?.type === 'output_text' && typeof m?.text === 'string') {
                  pieces.push(m.text);
                }
              }
            }
          }

          // Some providers embed plain `text` fields on the top-level item
          if (typeof item?.text === 'string') {
            pieces.push(item.text);
          }
        }
        if (pieces.length) return pieces.join('\n\n');
      }

      // 3) As a last resort, try choices-like structure (compat)
      if (Array.isArray(data?.choices)) {
        const txts = data.choices.map(c => c?.message?.content ?? c?.text ?? '').filter(Boolean);
        if (txts.length) return txts.join('\n\n');
      }

      return ''; // nothing extracted
    } catch (e) {
      console.error('extractResponseText error', e);
      return '';
    }
  };

  // Call OpenAI Responses API
  const callAPI = async (attemptNum) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not found in VITE_OPENAI_API_KEY');

    const body = {
      model: 'gpt-5', // use GPT-5 via Responses API
      input: `${systemPrompt}\n\nQUESTION:\n${question}\n\n${attemptNum > 1 ? 'IMPORTANT: Think carefully and verify your answer is correct before responding.' : ''}`,
      temperature: attemptNum === 1 ? 0.3 : 0.5,
      // limit output tokens (optional)
      max_output_tokens: 4000
    };

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OpenAI API request failed: ${res.status} ${res.statusText} ${txt}`);
    }

    const data = await res.json();
    const text = extractResponseText(data);
    return text;
  };

  const parseAnswer = (text) => {
    if (!text) return { analysis: '', answer: '', confidence: '' };

    const finalAnswerMatch = text.match(/\*\*FINAL ANSWER:\*\*\s*(.+?)(?=\n\n|Confidence:|$)/is);
    const confidenceMatch = text.match(/Confidence:\s*(.+?)(?=\n|$)/i);

    let analysis = text;
    if (finalAnswerMatch) analysis = text.substring(0, finalAnswerMatch.index);

    return {
      analysis: analysis.trim(),
      answer: finalAnswerMatch ? finalAnswerMatch[1].trim() : '',
      confidence: confidenceMatch ? confidenceMatch[1].trim() : '',
      fullText: text
    };
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError('');
    setAttempts([]);

    try {
      const attemptResults = [];

      for (let i = 1; i <= numAttempts; i++) {
        const responseText = await callAPI(i);
        const parsed = parseAnswer(responseText);

        attemptResults.push({
          attemptNum: i,
          response: responseText,
          parsed
        });

        // update UI incrementally
        setAttempts([...attemptResults]);

        if (i < numAttempts) {
          // short delay to avoid burst (keeps UI responsive)
          await new Promise(res => setTimeout(res, 500));
        }
      }
    } catch (err) {
      console.error('API Error:', err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const findConsensusAnswer = () => {
    if (attempts.length === 0) return null;

    const answerCounts = {};
    attempts.forEach(attempt => {
      const normalized = (attempt.parsed.answer || '').toLowerCase().trim().substring(0, 200);
      if (!normalized) return;
      if (!answerCounts[normalized]) answerCounts[normalized] = [];
      answerCounts[normalized].push(attempt);
    });

    let maxCount = 0;
    let consensusAnswer = null;
    Object.values(answerCounts).forEach(group => {
      if (group.length > maxCount) {
        maxCount = group.length;
        consensusAnswer = group[0];
      }
    });

    return {
      answer: consensusAnswer,
      agreement: maxCount,
      total: attempts.length,
      isConsensus: maxCount >= Math.ceil(attempts.length / 2)
    };
  };

  const consensus = findConsensusAnswer();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-3xl font-bold mb-2">TDS Exam Answer Generator v2</h1>
            <p className="text-blue-100">Multi-Attempt Verification System for Maximum Accuracy</p>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Enter Your Exam Question
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Paste your exam question here..."
                  className="w-full h-40 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  disabled={loading}
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="text-sm font-semibold text-gray-700">
                  Number of attempts:
                </label>
                <select
                  value={numAttempts}
                  onChange={(e) => setNumAttempts(Number(e.target.value))}
                  disabled={loading}
                  className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value={2}>2 (Fast)</option>
                  <option value={3}>3 (Balanced)</option>
                  <option value={5}>5 (Most Accurate)</option>
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    <span>Analyzing... ({attempts.length}/{numAttempts})</span>
                  </>
                ) : (
                  <>
                    <Target size={20} />
                    <span>Get Verified Answer</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start space-x-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {consensus && consensus.answer && (
              <div className="mt-6 space-y-4">
                <div className={`p-6 rounded-lg border-2 ${consensus.isConsensus ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500' : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-500'}`}>
                  <div className="flex items-start space-x-3 mb-4">
                    {consensus.isConsensus ? (
                      <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
                    ) : (
                      <AlertCircle className="text-yellow-600 flex-shrink-0 mt-1" size={24} />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-bold text-lg ${consensus.isConsensus ? 'text-green-900' : 'text-yellow-900'}`}>
                          {consensus.isConsensus ? '✅ CONSENSUS ANSWER' : '⚠️ BEST ANSWER (No Full Consensus)'}
                        </h3>
                        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${consensus.isConsensus ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>
                          {consensus.agreement}/{consensus.total} agree
                        </span>
                      </div>
                      <p className={`text-xl font-semibold ${consensus.isConsensus ? 'text-green-900' : 'text-yellow-900'}`}>
                        {consensus.answer.parsed.answer}
                      </p>
                    </div>
                  </div>

                  {!consensus.isConsensus && (
                    <div className="mt-4 p-3 bg-yellow-100 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Answers varied. Review all attempts below or try again with more attempts for better consensus.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <RefreshCw size={18} className="mr-2" />
                    All Attempts ({attempts.length})
                  </h3>
                  {attempts.map((attempt, idx) => (
                    <details key={attempt.attemptNum} className="bg-gray-50 rounded-lg border border-gray-200">
                      <summary className="cursor-pointer p-4 hover:bg-gray-100 font-medium text-gray-700">
                        Attempt {attempt.attemptNum} - Confidence: {attempt.parsed.confidence || 'Not specified'}
                      </summary>
                      <div className="p-4 border-t border-gray-200 space-y-3">
                        {attempt.parsed.analysis && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-600 mb-1">Analysis:</h4>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{attempt.parsed.analysis}</p>
                          </div>
                        )}
                        <div className="bg-white p-3 rounded border border-gray-300">
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Answer:</h4>
                          <p className="text-gray-900 font-mono text-sm whitespace-pre-wrap">{attempt.parsed.answer}</p>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-3">💡 How This Works:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• <strong>Multiple attempts:</strong> Calls GPT-5 {numAttempts} times with the same question</li>
              <li>• <strong>Consensus detection:</strong> Identifies when answers agree</li>
              <li>• <strong>✅ Green box:</strong> High confidence - majority of attempts agree</li>
              <li>• <strong>⚠️ Yellow box:</strong> Answers varied - review all attempts or retry</li>
              <li>• <strong>Best practice:</strong> Use 3-5 attempts for critical questions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
