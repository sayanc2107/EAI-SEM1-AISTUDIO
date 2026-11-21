import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured on the server. Add your key in Settings > Secrets."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function sendApiError(res: Response, error: unknown, contextLabel: string): void {
  const message =
    error instanceof Error ? error.message : "Unexpected Gemini API error.";
  const statusMatch = message.match(/\b(400|401|403|404|429|500|503)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : 500;
  console.error(`[MedCore AI] ${contextLabel} error:`, message);
  res.status(status).json({
    error: message,
    hint:
      status === 403 || status === 400
        ? "Verify your Gemini API key in Settings > Secrets."
        : status === 429
          ? "Rate limit reached. Please wait a moment and retry."
          : "Check server connectivity and try again.",
  });
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  // MongoDB Atlas Connection Setup
  const MONGODB_URI = process.env.MONGODB_URI;
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "medcoreai_aistudio";
  let mongoDb: unknown = null;

  async function initMongoDB() {
    if (!MONGODB_URI) {
      console.log("[MongoDB] No MONGODB_URI specified in env. MedCore AI operating in resilient static/client mode.");
      return;
    }
    try {
      // @ts-expect-error dynamic import for optional driver
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      mongoDb = client.db(MONGODB_DB_NAME);
      console.log(`[MongoDB] Connected successfully to database: ${MONGODB_DB_NAME}`);
    } catch (err) {
      console.warn("[MongoDB] Connection notice (resilient mode active):", err instanceof Error ? err.message : err);
    }
  }
  await initMongoDB();

  // MongoDB status endpoint
  app.get("/api/mongodb/status", (_req: Request, res: Response) => {
    res.json({
      connected: !!mongoDb,
      database: MONGODB_DB_NAME,
      cluster: "cluster0.njngnoe.mongodb.net",
      status: mongoDb ? "online" : "offline_client_mode",
    });
  });

  // 1. Live AI Emergency Triage Classification Endpoint
  app.post("/api/ai/triage", async (req: Request, res: Response) => {
    try {
      const { patient, availableBeds, onDutyDoctors } = req.body ?? {};
      if (!patient || !patient.symptoms) {
        res.status(400).json({ error: "Patient symptoms are required for triage." });
        return;
      }

      const ai = getGeminiClient();
      const prompt = `You are a clinical emergency triage decision-support AI inside MedCore AI Hospital Management System.
Evaluate the incoming patient's symptoms and vitals carefully and return a structured JSON triage recommendation.

Incoming Patient:
- Name: ${patient.name || "Unnamed Patient"}
- Age/Gender: ${patient.age ?? "Unknown"} / ${patient.gender || "Unknown"}
- Chief Symptoms: ${patient.symptoms}
- Heart Rate: ${patient.vitals?.heartRate ?? "N/A"} bpm
- Blood Pressure: ${patient.vitals?.bloodPressure || "N/A"} mmHg
- SpO2: ${patient.vitals?.spo2 ?? "N/A"}%
- Temperature: ${patient.vitals?.temperature ?? "N/A"} °F

Currently Available Beds:
${JSON.stringify(availableBeds ?? [], null, 2)}

Currently Available Doctors:
${JSON.stringify(onDutyDoctors ?? [], null, 2)}

Rules:
- Choose severity strictly from: "Critical", "Urgent", "Moderate", "Routine".
- Choose recommendedWard strictly from: "ICU", "Emergency", "Cardiology", "General".
- If an available bed matches the recommended ward, set suggestedBedId to that exact bed id; otherwise pick the best available bed id or "WAITLIST" if none exist.
- If an available doctor matches the specialty, set suggestedDoctorId to that exact doctor id; otherwise pick the least loaded available doctor id or "".
- Provide 3 to 4 concise, actionable immediate nursing/clinical protocol steps.
- Keep clinicalSummary clear, factual, and 2 sentences max.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a precise hospital emergency triage assistant supporting human clinicians. Never fabricate medical devices or beds not present in the provided context.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severity: {
                type: Type.STRING,
                description: "One of Critical, Urgent, Moderate, or Routine.",
              },
              department: {
                type: Type.STRING,
                description: "Recommended clinical department name.",
              },
              recommendedWard: {
                type: Type.STRING,
                description: "One of ICU, Emergency, Cardiology, or General.",
              },
              suggestedBedId: {
                type: Type.STRING,
                description: "Best matching available bed ID from the provided list, or WAITLIST.",
              },
              suggestedDoctorId: {
                type: Type.STRING,
                description: "Best matching doctor ID from the provided list.",
              },
              clinicalSummary: {
                type: Type.STRING,
                description: "Concise 2-sentence clinical rationale explaining the triage level.",
              },
              immediateActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 to 4 immediate nursing and triage steps.",
              },
              estimatedWaitMinutes: {
                type: Type.INTEGER,
                description: "Target physician contact time in minutes (0 for Critical).",
              },
            },
            required: [
              "severity",
              "department",
              "recommendedWard",
              "suggestedBedId",
              "suggestedDoctorId",
              "clinicalSummary",
              "immediateActions",
              "estimatedWaitMinutes",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "triage");
    }
  });

  // 2. Live AI Ward, Bed & Doctor Roster Optimizer Endpoint
  app.post("/api/ai/optimize", async (req: Request, res: Response) => {
    try {
      const { beds, doctors, patients } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `You are a hospital operations optimization AI analyzing real-time bed occupancy, doctor shift workloads, and patient acuity.

Active Hospital Snapshot:
- Beds: ${JSON.stringify(beds ?? [])}
- Doctors: ${JSON.stringify(doctors ?? [])}
- Active Patients: ${JSON.stringify(
        (patients ?? []).filter((p: { status?: string }) => p.status !== "Discharged")
      )}

Analyze current bottlenecks and produce:
1. overallStatus: "Nominal", "Elevated Load", or "High Strain".
2. riskSummary: 2 concise sentences summarizing hospital capacity and staffing balance.
3. bottlenecks: 2 to 3 specific operational bottlenecks observed directly in the provided data.
4. recommendations: 3 concrete, actionable staff recommendations. For each recommendation, include:
   - id (short string like "rec-1")
   - title (short action title)
   - detail (one sentence operational rationale)
   - impact (measurable outcome such as "Frees 2 ICU/ER beds" or "Reduces Cardiology doctor load")
   - actionType: choose "clear_cleaning_beds" if beds are in Cleaning status, "activate_oncall_doctor" if an On Call doctor can be moved to On Duty, or "advisory" for general clinical rebalancing.
   - targetId: optional bedId or doctorId when applicable (or empty string).`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are an enterprise hospital resource optimization AI. Reference exact ward names, bed IDs, and doctor names from the provided live snapshot.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallStatus: { type: Type.STRING },
              riskSummary: { type: Type.STRING },
              bottlenecks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                    targetId: { type: Type.STRING },
                  },
                  required: ["id", "title", "detail", "impact", "actionType", "targetId"],
                },
              },
            },
            required: ["overallStatus", "riskSummary", "bottlenecks", "recommendations"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "optimize");
    }
  });

  // 3. Live AI Pharmacy Demand Forecaster & Reorder Drafter
  app.post("/api/ai/forecast", async (req: Request, res: Response) => {
    try {
      const { inventory, activePatientCount, criticalPatientCount } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `You are a hospital clinical supply-chain forecasting AI.
Evaluate current pharmacy & medical supply inventory alongside current hospital patient load.

Hospital Load:
- Active admitted patients: ${activePatientCount ?? 0}
- Critical / ICU acuity patients: ${criticalPatientCount ?? 0}

Current Inventory:
${JSON.stringify(inventory ?? [])}

Identify the top 4 to 5 items that need attention or restocking (prioritizing items at or near minThreshold or with short days of supply based on dailyUsage and critical acuity).
Return structured JSON with:
- forecastHeadline: concise 1-sentence executive summary
- urgentRiskCount: integer count of high-urgency items
- projectedItems: array of items to reorder, each with exact itemId from the input, itemName, daysRemaining (integer), recommendedOrderQty (integer), priority ("Immediate" | "Soon" | "Routine"), and rationale (1 short sentence).`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a precise hospital pharmacy inventory forecasting AI. Use exact itemId and itemName values from the provided inventory list.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              forecastHeadline: { type: Type.STRING },
              urgentRiskCount: { type: Type.INTEGER },
              projectedItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    itemName: { type: Type.STRING },
                    daysRemaining: { type: Type.INTEGER },
                    recommendedOrderQty: { type: Type.INTEGER },
                    priority: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: [
                    "itemId",
                    "itemName",
                    "daysRemaining",
                    "recommendedOrderQty",
                    "priority",
                    "rationale",
                  ],
                },
              },
            },
            required: ["forecastHeadline", "urgentRiskCount", "projectedItems"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "forecast");
    }
  });

  // 4. Live AI Executive Shift Briefing
  app.post("/api/ai/briefing", async (req: Request, res: Response) => {
    try {
      const { summary } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `Generate a concise executive clinical shift handover briefing based on this live hospital snapshot:
${JSON.stringify(summary ?? {}, null, 2)}

Keep every point sharp, factual, and grounded exclusively in the numbers provided.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a hospital chief operations briefing assistant. Be concise, calm, factual, and operational.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              operationalMood: {
                type: Type.STRING,
                description: "One of Stable, Watchful, or High Alert.",
              },
              keyHighlights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              immediatePriorities: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ["headline", "operationalMood", "keyHighlights", "immediatePriorities"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "briefing");
    }
  });

  // 5. Live State-Grounded AI Hospital Operations Copilot
  app.post("/api/ai/copilot", async (req: Request, res: Response) => {
    try {
      const { question, history, hospitalState } = req.body ?? {};
      if (!question || typeof question !== "string") {
        res.status(400).json({ error: "A question is required." });
        return;
      }

      const ai = getGeminiClient();
      const recentHistory = Array.isArray(history) ? history.slice(-6) : [];

      const prompt = `Live Hospital Database Snapshot (ground truth):
${JSON.stringify(hospitalState ?? {})}

Recent Conversation History:
${JSON.stringify(recentHistory)}

User Question:
${question}

Answer clearly and concisely using exact patient names, bed IDs, doctor names, and inventory counts from the live snapshot above. If asked to draft a handover brief or report, format it cleanly with short paragraphs or bullet points.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are MedCore AI Operations Copilot, a live hospital management assistant. Ground every statement in the provided live hospital snapshot. Keep answers clear, structured, and easy to read during a live classroom demonstration.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: "Clear operational response grounded in live hospital data.",
              },
              referencedFacts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 to 3 short factual data points cited from the hospital state.",
              },
              suggestedFollowUps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 short suggested follow-up questions the user can click next.",
              },
            },
            required: ["answer", "referencedFacts", "suggestedFollowUps"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "copilot");
    }
  });

  // 6. Pharmacist AI Sales Velocity & Restock Advisor
  app.post("/api/ai/pharmacy-insights", async (req: Request, res: Response) => {
    try {
      const { sales, inventory, pendingPrescriptions } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `You are a hospital pharmacy inventory & sales analytics AI.
Analyze actual pharmacy sales receipts, current stock counts, and pending doctor prescriptions to tell the pharmacist:
1. Which medicines are selling the most (topSellingItems, 3 to 5 items sorted by sales demand).
2. Which medicines urgently need more stock added (restockSuggestions, 3 to 5 items referencing exact itemId from inventory).

Pharmacy Sales History:
${JSON.stringify(sales ?? [])}

Current Pharmacy Inventory:
${JSON.stringify(inventory ?? [])}

Pending/Ready Doctor Prescriptions:
${JSON.stringify(pendingPrescriptions ?? [])}

Rules:
- Use exact itemId and itemName values from the inventory list for restockSuggestions.
- Keep reasons crisp, quantitative, and directly grounded in units sold, pending Rx demand, and current stock vs minThreshold.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a precise clinical pharmacy inventory & sales intelligence assistant.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              topSellingItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    unitsSold: { type: Type.INTEGER },
                    revenue: { type: Type.NUMBER },
                    trendNote: { type: Type.STRING },
                  },
                  required: ["itemName", "unitsSold", "revenue", "trendNote"],
                },
              },
              restockSuggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemId: { type: Type.STRING },
                    itemName: { type: Type.STRING },
                    currentStock: { type: Type.INTEGER },
                    recommendedAddQty: { type: Type.INTEGER },
                    urgency: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: [
                    "itemId",
                    "itemName",
                    "currentStock",
                    "recommendedAddQty",
                    "urgency",
                    "reason",
                  ],
                },
              },
            },
            required: ["headline", "topSellingItems", "restockSuggestions"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "pharmacy-insights");
    }
  });

  // 7. Ward Staff AI Early-Call & Pre-Positioning Predictor
  app.post("/api/ai/ward-predict", async (req: Request, res: Response) => {
    try {
      const { wardStaffShift, beds, activePatients, onDutyDoctors } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `You are a proactive hospital ward logistics AI helping Ward Staff arrive EARLY where they will soon be called so zero clinical delay occurs.

Ward Staff Member's Shift:
${JSON.stringify(wardStaffShift ?? {})}

Live Bed Matrix:
${JSON.stringify(beds ?? [])}

Active Hospital Patients (vitals & severity):
${JSON.stringify(activePatients ?? [])}

On-Duty Doctors (locations & shift end times):
${JSON.stringify(onDutyDoctors ?? [])}

Predict the top 3 to 4 locations/beds where ward staff are most likely to be summoned soon (e.g., rapid bed sanitization before ER transfer, critical patient oxygen/stretcher support, pre-handover rounds near a doctor whose shift ends soon).
For each prediction return:
- id (e.g., "wp-1")
- targetZone (e.g., "ICU Ward", "Emergency Bay")
- bedOrRoom (exact bed ID like "ICU-03" or "ER-01")
- urgency ("Immediate" | "Soon" | "Watch")
- etaMinutes (integer: estimated minutes until call arrives, e.g., 5, 12, 20)
- reason (1 concise sentence explaining the clinical/operational trigger)
- recommendedPrep (concrete early action or gear to bring now)`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a proactive hospital ward dispatch predictor. Help ward attendants pre-position early based on real vitals, cleaning beds, and shift end times.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              predictions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    targetZone: { type: Type.STRING },
                    bedOrRoom: { type: Type.STRING },
                    urgency: { type: Type.STRING },
                    etaMinutes: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                    recommendedPrep: { type: Type.STRING },
                  },
                  required: [
                    "id",
                    "targetZone",
                    "bedOrRoom",
                    "urgency",
                    "etaMinutes",
                    "reason",
                    "recommendedPrep",
                  ],
                },
              },
            },
            required: ["summary", "predictions"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "ward-predict");
    }
  });

  // 8. Nurse AI Next-Action Clinical Care Predictor
  app.post("/api/ai/nurse-predict", async (req: Request, res: Response) => {
    try {
      const { nurseShift, allottedPatients, allottedDoctors, allDoctors, pendingPrescriptions } =
        req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `You are a clinical nursing workflow predictor inside MedCore AI.
Analyze this nurse's allotted patients, their vitals/severity, ready prescriptions, and current doctor availability to predict and prioritize what the nurse should do NEXT.

Nurse Shift:
${JSON.stringify(nurseShift ?? {})}

Allotted Patients:
${JSON.stringify(allottedPatients ?? [])}

Allotted Supervising Doctors:
${JSON.stringify(allottedDoctors ?? [])}

All Hospital Doctors Current Status (who is On Duty / In Surgery / On Call):
${JSON.stringify(allDoctors ?? [])}

Related Prescriptions:
${JSON.stringify(pendingPrescriptions ?? [])}

Return an ordered list of 3 to 5 prioritized next actions (priorityRank 1 = do immediately).
For each action specify:
- id (e.g., "na-1")
- priorityRank (integer 1..5)
- patientName (exact name from allottedPatients)
- bedId (exact bed ID)
- actionTitle (concise clinical task title)
- clinicalReason (1 concise sentence referencing real vitals or pending meds)
- doctorToCall (exact name & status of the best doctor to notify if escalation is needed, avoiding doctors currently In Surgery or Off Duty)
- dueWindow (e.g., "Now (0–5 min)", "Next 15 min", "Next 30 min")`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "You are a precise clinical nursing triage and task-sequencing AI. Prioritize unstable vitals and ready medications first, and route escalations to On Duty or On Call doctors.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              shiftFocusSummary: { type: Type.STRING },
              nextActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    priorityRank: { type: Type.INTEGER },
                    patientName: { type: Type.STRING },
                    bedId: { type: Type.STRING },
                    actionTitle: { type: Type.STRING },
                    clinicalReason: { type: Type.STRING },
                    doctorToCall: { type: Type.STRING },
                    dueWindow: { type: Type.STRING },
                  },
                  required: [
                    "id",
                    "priorityRank",
                    "patientName",
                    "bedId",
                    "actionTitle",
                    "clinicalReason",
                    "doctorToCall",
                    "dueWindow",
                  ],
                },
              },
            },
            required: ["shiftFocusSummary", "nextActions"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      sendApiError(res, error, "nurse-predict");
    }
  });

  // Serve Vite dev middleware in development or compiled dist/ in production
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("/{*splat}", (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MedCore AI server running on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error("Failed to start MedCore AI server:", err);
  process.exit(1);
});
