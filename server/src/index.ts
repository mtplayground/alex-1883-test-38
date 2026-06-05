import { createApp } from "./app.js";
import { serverConfig, validateEnvironment } from "./config.js";
import { connectDatabase, disconnectDatabase } from "./db/client.js";
import { logErrorDetails } from "./http/errors.js";

const logError = (message: string, error: unknown) => {
  logErrorDetails(message, error);
};

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDatabase();

    const app = createApp();
    const server = app.listen(serverConfig.port, serverConfig.host, () => {
      console.log(
        `alex-1883-test-38 server listening on http://${serverConfig.host}:${serverConfig.port}`
      );
    });

    const shutdown = (signal: NodeJS.Signals) => {
      console.log(`Received ${signal}; shutting down server`);
      server.close((error) => {
        void disconnectDatabase()
          .catch((disconnectError: unknown) => {
            logError("Database disconnect failed", disconnectError);
            process.exitCode = 1;
          })
          .finally(() => {
            if (error) {
              logError("Server shutdown failed", error);
              process.exitCode = 1;
            }

            process.exit();
          });
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logError("Server startup failed", error);
    process.exit(1);
  }
};

void startServer();
