import serverless from "serverless-http";
import { createApp } from "../../server/_core/app";

const app = createApp();

export const handler = serverless(app, {
  binary: ["image/*", "application/octet-stream"],
});
