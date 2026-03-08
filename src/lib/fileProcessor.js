// File processing utilities for PDF, DOCX, and TXT files

export async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return await file.text();
  }

  if (ext === 'pdf') {
    return await extractTextFromPDF(file);
  }

  if (ext === 'docx' || ext === 'doc') {
    return await extractTextFromDOCX(file);
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

async function extractTextFromPDF(file) {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += pageText + '\n';
    }

    return text.trim();
  } catch (e) {
    throw new Error(`PDF extraction failed: ${e.message}`);
  }
}

async function extractTextFromDOCX(file) {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } catch (e) {
    throw new Error(`DOCX extraction failed: ${e.message}`);
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function validateFile(file) {
  const allowed = ['pdf', 'docx', 'doc', 'txt'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    return `File type .${ext} is not supported. Use PDF, DOCX, or TXT.`;
  }
  if (file.size > 10 * 1024 * 1024) {
    return `File ${file.name} exceeds 10MB limit.`;
  }
  return null;
}
