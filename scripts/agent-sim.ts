#!/usr/bin/env npx tsx
import crypto from "crypto";

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const ENROLLMENT_TOKEN = process.env.ENROLLMENT_TOKEN || "";
const NUM_DEVICES = parseInt(process.env.NUM_DEVICES || "3", 10);
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || "10", 10) * 1000;

interface EnrolledDevice {
  deviceId: string;
  agentToken: string;
  name: string;
  os: string;
  state: "idle" | "indexing" | "syncing" | "paused";
  policyVersion: number;
  queueDepth: number;
}

const DEVICE_TEMPLATES = [
  { name: "Macbook Pro - Engineering", os: "macOS Sonoma 14.2" },
  { name: "Dell Workstation - Design", os: "Windows 11 Pro" },
  { name: "Mac Mini - Server Room", os: "macOS Ventura 13.5" },
  { name: "Surface Pro - Sales", os: "Windows 11" },
  { name: "iMac - Marketing", os: "macOS Monterey 12.6" },
  { name: "ThinkPad - Finance", os: "Windows 10 Enterprise" },
  { name: "MacBook Air - HR", os: "macOS Sonoma 14.0" },
  { name: "HP EliteDesk - IT Support", os: "Windows 11 Pro" },
];

const devices: EnrolledDevice[] = [];

async function enrollDevice(template: { name: string; os: string }): Promise<EnrolledDevice | null> {
  try {
    const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
    const name = `${template.name} (${suffix})`;

    const res = await fetch(`${API_BASE}/api/agent/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_enrollment_token: ENROLLMENT_TOKEN,
        device_name: name,
        os: template.os,
        version: "1.0.0-sim",
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[Enroll] Failed for ${name}: ${res.status} - ${error}`);
      return null;
    }

    const data = await res.json();
    console.log(`[Enroll] ✓ ${name} -> ${data.device_id.slice(0, 8)}...`);

    return {
      deviceId: data.device_id,
      agentToken: data.agent_token,
      name,
      os: template.os,
      state: "idle",
      policyVersion: 0,
      queueDepth: 0,
    };
  } catch (error) {
    console.error(`[Enroll] Network error:`, error);
    return null;
  }
}

async function sendHeartbeat(device: EnrolledDevice): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/agent/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${device.agentToken}`,
      },
      body: JSON.stringify({
        last_state: device.state,
        queue_depth: device.queueDepth,
        version: "1.0.0-sim",
        os: device.os,
        applied_policy_version: device.policyVersion,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[Heartbeat] Failed for ${device.name}: ${res.status} - ${error}`);
      return;
    }

    console.log(`[Heartbeat] ${device.name.slice(0, 25).padEnd(25)} | state=${device.state.padEnd(8)} | policy=v${device.policyVersion}`);
  } catch (error) {
    console.error(`[Heartbeat] Network error for ${device.name}:`, error);
  }
}

async function fetchPolicy(device: EnrolledDevice): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/agent/policy`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${device.agentToken}`,
      },
    });

    if (!res.ok) {
      console.error(`[Policy] Failed for ${device.name}: ${res.status}`);
      return;
    }

    const data = await res.json();
    if (data.version > device.policyVersion) {
      console.log(`[Policy] ${device.name} updated: v${device.policyVersion} -> v${data.version}`);
      device.policyVersion = data.version;
    }
  } catch (error) {
    console.error(`[Policy] Network error for ${device.name}:`, error);
  }
}

async function pollCommands(device: EnrolledDevice): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/agent/commands/poll`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${device.agentToken}`,
      },
    });

    if (!res.ok) {
      console.error(`[Commands] Failed for ${device.name}: ${res.status}`);
      return;
    }

    const data = await res.json();
    
    for (const cmd of data.commands || []) {
      console.log(`[Command] ${device.name} received: ${cmd.type} (${cmd.id.slice(0, 8)}...)`);

      if (cmd.type === "resync") {
        device.state = "syncing";
        device.queueDepth = Math.floor(Math.random() * 50) + 10;
      } else if (cmd.type === "pause") {
        device.state = "paused";
      } else if (cmd.type === "resume") {
        device.state = "idle";
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      await fetch(`${API_BASE}/api/agent/commands/result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${device.agentToken}`,
        },
        body: JSON.stringify({
          command_id: cmd.id,
          status: "succeeded",
          result: { executed_at: new Date().toISOString() },
        }),
      });

      console.log(`[Command] ${device.name} completed: ${cmd.type}`);
    }
  } catch (error) {
    console.error(`[Commands] Network error for ${device.name}:`, error);
  }
}

async function sendEvent(device: EnrolledDevice, type: string, message: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/agent/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${device.agentToken}`,
      },
      body: JSON.stringify({
        type,
        message,
        payload: { timestamp: new Date().toISOString() },
      }),
    });
  } catch (error) {
    console.error(`[Event] Error:`, error);
  }
}

function simulateStateChanges(device: EnrolledDevice): void {
  if (device.state === "syncing") {
    device.queueDepth = Math.max(0, device.queueDepth - Math.floor(Math.random() * 10));
    if (device.queueDepth === 0) {
      device.state = "idle";
      console.log(`[State] ${device.name} finished syncing`);
    }
  } else if (device.state === "idle" && Math.random() < 0.1) {
    device.state = "indexing";
    device.queueDepth = Math.floor(Math.random() * 20) + 5;
    console.log(`[State] ${device.name} started indexing`);
  } else if (device.state === "indexing") {
    device.queueDepth = Math.max(0, device.queueDepth - Math.floor(Math.random() * 5));
    if (device.queueDepth === 0) {
      device.state = "idle";
    }
  }
}

async function runSimulation(): Promise<void> {
  console.log("=========================================");
  console.log("   Evident Agent Simulator");
  console.log("=========================================");
  console.log(`API Base: ${API_BASE}`);
  console.log(`Devices: ${NUM_DEVICES}`);
  console.log(`Heartbeat: ${HEARTBEAT_INTERVAL / 1000}s`);
  console.log("");

  if (!ENROLLMENT_TOKEN) {
    console.error("ERROR: ENROLLMENT_TOKEN environment variable is required.");
    console.error("Run the seed script first: npx tsx server/seed-enterprise.ts");
    console.error("Then set: export ENROLLMENT_TOKEN=<token_from_output>");
    process.exit(1);
  }

  console.log("[Phase 1] Enrolling devices...");
  
  for (let i = 0; i < NUM_DEVICES; i++) {
    const template = DEVICE_TEMPLATES[i % DEVICE_TEMPLATES.length];
    const device = await enrollDevice(template);
    if (device) {
      devices.push(device);
      await sendEvent(device, "boot", "Agent started");
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (devices.length === 0) {
    console.error("No devices enrolled. Exiting.");
    process.exit(1);
  }

  console.log("");
  console.log(`[Phase 2] Running simulation with ${devices.length} devices...`);
  console.log("Press Ctrl+C to stop.");
  console.log("");

  while (true) {
    for (const device of devices) {
      simulateStateChanges(device);
      await fetchPolicy(device);
      await pollCommands(device);
      await sendHeartbeat(device);
    }
    
    await new Promise(resolve => setTimeout(resolve, HEARTBEAT_INTERVAL));
  }
}

runSimulation().catch(console.error);
