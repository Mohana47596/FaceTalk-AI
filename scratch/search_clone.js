import fs from 'fs';
import path from 'path';

const dir = 'src/components';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.jsx')) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes('SkeletonUtils')) {
      console.log(`File: ${file} contains SkeletonUtils`);
      // Find lines with SkeletonUtils
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('SkeletonUtils')) {
          console.log(`  Line ${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
});
