
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GeminiContentResult {
  text: string;
  sources: GroundingChunk[];
}
