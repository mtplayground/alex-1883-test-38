export type ServerConfig = {
  host: string;
  port: number;
  nodeEnv: string;
};

const parsePort = (value: string | undefined): number => {
  if (!value) {
    return 8080;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
};

export const config: ServerConfig = {
  host: process.env.HOST ?? "0.0.0.0",
  port: parsePort(process.env.PORT),
  nodeEnv: process.env.NODE_ENV ?? "development"
};
