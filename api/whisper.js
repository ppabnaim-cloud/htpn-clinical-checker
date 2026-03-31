import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const audioFile = files.file?.[0] || files.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const fileStream = fs.createReadStream(audioFile.filepath);
    const formData = new FormData();
    formData.append('file', fileStream, {
      filename: audioFile.originalFilename || 'audio.m4a',
      contentType: audioFile.mimetype || 'audio/m4a',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Whisper error' });
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Whisper proxy error: ' + err.message });
  }
}
