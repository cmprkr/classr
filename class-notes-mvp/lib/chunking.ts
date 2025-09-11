// lib/chunking.ts
export function chunkTranscript(segments: {start:number,end:number,text:string}[]) {
  const chunks: {text:string,start:number,end:number}[] = [];
  if (!segments.length) return chunks;
  let buf = "", start = segments[0].start, end = segments[0].end;

  for (const s of segments) {
    const t = s.text.trim();
    if (!t) continue;
    if ((buf + " " + t).length > 800) {
      chunks.push({ text: buf.trim(), start, end });
      buf = t; start = s.start; end = s.end;
    } else {
      buf = (buf ? buf + " " : "") + t;
      end = s.end;
    }
  }
  if (buf) chunks.push({ text: buf.trim(), start, end });
  return chunks;
}

export function cosine(a:number[], b:number[]) {
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
  return dot/(Math.sqrt(na)*Math.sqrt(nb) || 1);
}
