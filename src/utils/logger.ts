export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: Array<{ level: LogLevel; message: string; timestamp: string }> = [];

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  private log(level: LogLevel, message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = { level, message, timestamp };
    this.logs.push(logEntry);

    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    if (levelOrder.indexOf(level) >= levelOrder.indexOf(this.logLevel)) {
      console.log(`[${timestamp}] ${level}: ${message}`);
    }
  }

  getLogs(): Array<{ level: LogLevel; message: string; timestamp: string }> {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
