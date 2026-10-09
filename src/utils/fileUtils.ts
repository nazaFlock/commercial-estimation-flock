import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger.js';

export function readJsonFile<T>(filePath: string): T {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    logger.error(`Failed to read JSON file: ${filePath}`);
    throw error;
  }
}

export function writeJsonFile<T>(filePath: string, data: T, pretty = true): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.debug(`Written to JSON file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write JSON file: ${filePath}`);
    throw error;
  }
}

export function readTextFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    logger.error(`Failed to read text file: ${filePath}`);
    throw error;
  }
}

export function writeTextFile(filePath: string, content: string): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    logger.debug(`Written to text file: ${filePath}`);
  } catch (error) {
    logger.error(`Failed to write text file: ${filePath}`);
    throw error;
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function listJsonFiles(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    return fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.join(dirPath, file));
  } catch (error) {
    logger.error(`Failed to list files in directory: ${dirPath}`);
    return [];
  }
}

export function createDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`Created directory: ${dirPath}`);
  }
}

export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
