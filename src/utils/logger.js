export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor() {
        this.logLevel = LogLevel.INFO;
        this.logs = [];
    }
    setLogLevel(level) {
        this.logLevel = level;
    }
    debug(message) {
        this.log(LogLevel.DEBUG, message);
    }
    info(message) {
        this.log(LogLevel.INFO, message);
    }
    warn(message) {
        this.log(LogLevel.WARN, message);
    }
    error(message) {
        this.log(LogLevel.ERROR, message);
    }
    log(level, message) {
        const timestamp = new Date().toISOString();
        const logEntry = { level, message, timestamp };
        this.logs.push(logEntry);
        const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        if (levelOrder.indexOf(level) >= levelOrder.indexOf(this.logLevel)) {
            console.log(`[${timestamp}] ${level}: ${message}`);
        }
    }
    getLogs() {
        return this.logs;
    }
    clearLogs() {
        this.logs = [];
    }
}
export const logger = new Logger();
