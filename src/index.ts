import fs from "node:fs";
import { loadEnvFile } from "node:process";
import { Api, TelegramClient } from "telegram";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { StringSession } from "telegram/sessions";
import {
  DownloadError,
  FileDeleteError,
  GeneralError,
  sendErrorMessage,
  UploadError,
} from "./errors";

// Load env files
loadEnvFile();

// Validate Environment Variables
function validateEnv() {
  const requiredVars = [
    "STRING_SESSION",
    "API_ID",
    "API_HASH",
    "GROUP_ID_TARGET",
    "BOT_USER_ID",
    "GROUP_ID_MINE",
  ];
  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      throw new Error(`Environment variable ${variable} is not set`);
    }
  }
}

validateEnv();

// Define constants from env
const stringSession = new StringSession(process.env.STRING_SESSION || "");
const apiId = Number.parseInt(process.env.API_ID || "0");
const apiHash = process.env.API_HASH || "";
const groupIDTarget = process.env.GROUP_ID_TARGET
  ? Number.parseInt(process.env.GROUP_ID_TARGET)
  : 0;
const myGroupId = process.env.GROUP_ID_MINE
  ? Number.parseInt(process.env.GROUP_ID_MINE)
  : 0;
const botUserId = process.env.BOT_USER_ID
  ? Number.parseInt(process.env.BOT_USER_ID)
  : undefined;

// Initialize Telegram Client
export const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Validate Event
function isValidEvent(event: NewMessageEvent) {
  const chatId = event.chatId?.toJSNumber();
  const fromId = event.message.fromId;

  return (
    chatId === groupIDTarget &&
    fromId?.className === "PeerUser" &&
    fromId.userId?.toJSNumber() === botUserId
  );
}

async function downloadMedia(media: Api.TypeMessageMedia, filePath: string) {
  try {
    await client.downloadMedia(media, { outputFile: filePath });
  } catch (downloadError) {
    if (downloadError instanceof Error) {
      await sendErrorMessage(
        new DownloadError(`Error downloading media: ${downloadError.message}`),
      );
    }
    throw downloadError;
  }
}

async function uploadFile(filePath: string) {
  try {
    const file = await client.sendFile(myGroupId, { file: filePath });
    return file;
  } catch (uploadError) {
    if (uploadError instanceof Error) {
      await sendErrorMessage(
        new UploadError(`Error uploading media: ${uploadError.message}`),
      );
    }
    throw uploadError;
  }
}

function deleteLocalFile(filePath: string) {
  try {
    fs.unlinkSync(filePath);
  } catch (deleteError) {
    if (deleteError instanceof Error) {
      sendErrorMessage(
        new FileDeleteError(
          `Error deleting local file: ${deleteError.message}`,
        ),
      );
    }
  }
}

async function handler(event: NewMessageEvent) {
  try {
    if (!isValidEvent(event)) return;

    const media = event.message.media;
    if (media?.className === "MessageMediaPhoto" && media.photo) {
      const filePath = `./downloads/photo_${media.photo.id.toString()}.jpg`;

      await downloadMedia(media, filePath);
      const file = await uploadFile(filePath);
      await file.reply({ message: "/search" });
      deleteLocalFile(filePath);
    }
  } catch (error) {
    if (error instanceof Error) {
      await sendErrorMessage(
        new GeneralError(`Error in handler: ${error.message}`),
      );
    }
  }
}

const main = async () => {
  try {
    await client.connect();
    console.log("Connected");

    if (!fs.existsSync("./downloads")) {
      fs.mkdirSync("./downloads");
    }

    await client.sendMessage("me", { message: "Hello myself!" });

    // client.addEventHandler(
    //   async (event: NewMessageEvent) => {},
    //   new NewMessage({}),
    // );

    client.addEventHandler(handler, new NewMessage({}));
  } catch (mainError) {
    if (mainError instanceof Error) {
      await sendErrorMessage(
        new GeneralError(`Error in main setup: ${mainError.message}`),
      );
    }
  }
};

main().catch((err) => console.error(err));

// Graceful Shutdown
process.on("SIGINT", async () => {
  try {
    console.log("Disconnecting...");
    await client.disconnect();
    process.exit(0);
  } catch (shutdownError) {
    console.error("Error during shutdown:", shutdownError);
    process.exit(1);
  }
});
