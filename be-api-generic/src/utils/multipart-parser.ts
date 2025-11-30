/**
 * Multipart form data parser for Bun
 * Parses multipart/form-data requests natively in Bun
 */

export interface ParsedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ParsedFormData {
  fields: Record<string, string>;
  files: ParsedFile[];
}

/**
 * Parse multipart/form-data from a Request
 */
export async function parseMultipartFormData(req: Request): Promise<ParsedFormData> {
  console.log(req.headers);
  const contentType = req.headers.get('content-type');

  console.log('[MultipartParser] Content-Type:', contentType);

  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }

  try {
    const formData = await req.formData();
    const fields: Record<string, string> = {};
    const files: ParsedFile[] = [];

    console.log('[MultipartParser] FormData entries count:', Array.from(formData.entries()).length);

    for (const [key, value] of formData.entries()) {
      console.log('[MultipartParser] Entry:', key, typeof value, value instanceof File);

      if (value instanceof File) {
        // Handle file
        const arrayBuffer = await value.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('[MultipartParser] File found:', {
          fieldname: key,
          filename: value.name,
          size: buffer.length,
          type: value.type
        });

        files.push({
          fieldname: key,
          originalname: value.name,
          encoding: '7bit',
          mimetype: value.type || 'application/octet-stream',
          buffer,
          size: buffer.length,
        });
      } else {
        // Handle regular field
        fields[key] = value as any;
      }
    }

    console.log('[MultipartParser] Parsed result:', { fieldsCount: Object.keys(fields).length, filesCount: files.length });

    return { fields, files };
  } catch (error: any) {
    console.error('[MultipartParser] Error:', error);
    throw new Error(`Failed to parse multipart data: ${error.message}`);
  }
}

/**
 * Get a single file from form data by field name
 */
export function getFile(formData: ParsedFormData, fieldName: string = 'file'): ParsedFile | null {
  return formData.files.find(f => f.fieldname === fieldName) || null;
}

/**
 * Get multiple files from form data by field name
 */
export function getFiles(formData: ParsedFormData, fieldName: string = 'files'): ParsedFile[] {
  return formData.files.filter(f => f.fieldname === fieldName);
}

/**
 * Validate file type against allowed MIME types
 */
export function validateFileType(file: ParsedFile, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.mimetype);
}

/**
 * Validate file size
 */
export function validateFileSize(file: ParsedFile, maxSize: number): boolean {
  return file.size <= maxSize;
}
