export interface StreamingLog {
  date: Date;
  type: string;
  message: any;
}

export interface LiveClientOptions {
  apiKey: string;
}