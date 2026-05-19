const isProduction = Deno.env.get("DENO_ENV") === "production";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function timestamp(): string {
  return new Date().toISOString();
}

function log(
  level: "INFO" | "WARN" | "ERROR" | "DEBUG",
  message: string,
  ...args: unknown[]
) {
  const time = timestamp();

  if (isProduction) {
    const logObject: Record<string, unknown> = {
      timestamp: time,
      level,
      message,
    };

    if (args.length > 0) {
      logObject.details = args.map((arg) => {
        if (arg instanceof Error) {
          return {
            name: arg.name,
            message: arg.message,
            stack: arg.stack,
          };
        }
        return arg;
      });
    }

    const jsonString = JSON.stringify(logObject);

    switch (level) {
      case "INFO":
        console.log(jsonString);
        break;
      case "WARN":
        console.warn(jsonString);
        break;
      case "ERROR":
        console.error(jsonString);
        break;
      case "DEBUG":
        console.debug(jsonString);
        break;
    }
  } else {
    let color = COLORS.reset;
    let consoleMethod = console.log;

    switch (level) {
      case "INFO":
        color = COLORS.green;
        consoleMethod = console.log;
        break;
      case "WARN":
        color = COLORS.yellow;
        consoleMethod = console.warn;
        break;
      case "ERROR":
        color = COLORS.red;
        consoleMethod = console.error;
        break;
      case "DEBUG":
        color = COLORS.cyan;
        consoleMethod = console.debug;
        break;
    }

    consoleMethod(
      `${COLORS.dim}[${time}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${message}`,
      ...args,
    );
  }
}

export const logger = {
  info(message: string, ...args: unknown[]) {
    log("INFO", message, ...args);
  },

  warn(message: string, ...args: unknown[]) {
    log("WARN", message, ...args);
  },

  error(message: string, ...args: unknown[]) {
    log("ERROR", message, ...args);
  },

  debug(message: string, ...args: unknown[]) {
    if (!isProduction) {
      log("DEBUG", message, ...args);
    }
  },
};
