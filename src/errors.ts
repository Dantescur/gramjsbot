import { client } from ".";

export class DownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DownloadError";
  }
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

export class FileDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileDeleteError";
  }
}

export class GeneralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneralError";
  }
}

export async function sendErrorMessage(error: Error) {
  const errorMessage = `Error: ${error.name}\nMessage: ${error.message}`;
  try {
    await client.sendMessage("me", { message: errorMessage });
  } catch (sendError) {
    console.error("Failed to send error message:", sendError);
  }
}
