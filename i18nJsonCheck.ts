import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { appBancaDir } from './constants';

// Percorsi delle directory
const dir1: string = path.join(appBancaDir, 'assets/flutter_i18n/it');
const dir2: string = path.join(appBancaDir, 'bridge/assets/flutter_i18n/it');

// Simboli Unicode per la leggibilità
const CHECK = '✅';  // Verde - tutto ok
const CROSS = '❌';  // Rosso - errore
const WARNING = '⚠️'; // Giallo - avviso
const DOT = '🔹';  // Punto elenco per file

// Funzione per ottenere l'hash di un file
type FileCheckResult = { file: string, keysWithMultipleValues: string[] };
type JsonValidityResult = { file: string, valid: boolean, error?: string };

const getFileHash = (filePath: string): string => {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
};

// Funzione per ottenere una lista ricorsiva dei file in una directory
const getAllFiles = (dir: string): string[] => {
    let files: string[] = [];
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            files = files.concat(getAllFiles(filePath));
        } else {
            files.push(filePath);
        }
    });
    return files;
};

const checkJsonUniqueness = (baseDir: string): FileCheckResult[] => {
    const jsonFiles = fs.readdirSync(baseDir).filter(file => file.endsWith('.json'));
    return jsonFiles.map(file => {
        const filePath = path.join(baseDir, file);
        const rawData = fs.readFileSync(filePath, 'utf-8').trim().replace(/^﻿/, '');
        const entryRegex = /"([^"\\]+)":\s*"((?:[^"\\]|\\.)*)"/g;
        const entries: { key: string; value: string }[] = [];

        let match;
        while ((match = entryRegex.exec(rawData)) !== null) {
            entries.push({ key: match[1], value: match[2] });
        }

        const grouped = new Map<string, Set<string>>();
        entries.forEach(({ key, value }) => {
            if (!grouped.has(key)) grouped.set(key, new Set());
            grouped.get(key)!.add(value);
        });

        const keysWithMultipleValues = Array.from(grouped.entries())
            .filter(([_, values]) => values.size > 1)
            .map(([key]) => key);

        return { file, keysWithMultipleValues };
    });
};

const checkJsonValidity = (baseDir: string): JsonValidityResult[] => {
    const jsonFiles = fs.readdirSync(baseDir).filter(file => file.endsWith('.json'));
    return jsonFiles.map(file => {
        const filePath = path.join(baseDir, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8').trim().replace(/^﻿/, '');
            JSON.parse(content);
            return { file, valid: true };
        } catch (e: any) {
            return { file, valid: false, error: e.message };
        }
    });
};

// === STEP 1/3: Unicità dei valori per chiave ===
console.log(`\n📂 (1/3) Verifica unicità dei valori per chiave nei file JSON\n`);
const uniquenessResults = checkJsonUniqueness(dir1);
const failed = uniquenessResults.filter(res => res.keysWithMultipleValues.length > 0);

if (failed.length > 0) {
    console.log(`${WARNING} File che NON passano il controllo (${failed.length}):`);
    failed.forEach(res => {
        console.log(`  ${DOT} ${res.file}`);
        res.keysWithMultipleValues.forEach(key => {
            console.log(`     - Chiave con più valori: ${key}`);
        });
    });
} else {
    console.log(`${CHECK} Tutti i file hanno valori univoci per ogni chiave.`);
}

// === STEP 2/3: Validità del formato JSON ===
console.log(`\n📂 (2/3) Verifica validità formato JSON\n`);
const validityResults = checkJsonValidity(dir1);
const invalidJsonFiles = validityResults.filter(res => !res.valid);

if (invalidJsonFiles.length > 0) {
    console.log(`${CROSS} File JSON non validi (${invalidJsonFiles.length}):`);
    invalidJsonFiles.forEach(res => {
        console.log(`  ${DOT} ${res.file}`);
        console.log(`     - Errore: ${res.error}`);
    });
} else {
    console.log(`${CHECK} Tutti i file JSON sono validi.`);
}

// === BLOCCO se errori trovati ===
if (failed.length > 0 || invalidJsonFiles.length > 0) {
    console.log(`\n${CROSS} Sono stati trovati errori nei passaggi precedenti.`);
    console.log(`❗ Correggere i file prima di procedere al confronto tra le directory.`);
    process.exit(1);
}

// === STEP 3/3: Confronto directory ===
console.log(`\n📂 (3/3) Confronto dei file JSON tra assets e bridge/assets\n`);

const files1 = getAllFiles(dir1).map(file => path.relative(dir1, file));
const files2 = getAllFiles(dir2).map(file => path.relative(dir2, file));

const onlyInDir1 = files1.filter(file => !files2.includes(file));
const onlyInDir2 = files2.filter(file => !files1.includes(file));
const commonFiles = files1.filter(file => files2.includes(file));
const differentContent = commonFiles.filter(file =>
    getFileHash(path.join(dir1, file)) !== getFileHash(path.join(dir2, file))
);

if (onlyInDir1.length > 0) {
    console.log(`${CROSS} File presenti solo in ${dir1}:`);
    onlyInDir1.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessun file mancante in ${dir1}`);
}

if (onlyInDir2.length > 0) {
    console.log(`${CROSS} File presenti solo in ${dir2}:`);
    onlyInDir2.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessun file mancante in ${dir2}`);
}

if (differentContent.length > 0) {
    console.log(`${WARNING} File con contenuti diversi:`);
    differentContent.forEach(file => console.log(`  ${DOT} ${file}`));
} else {
    console.log(`${CHECK} Nessuna differenza nei contenuti dei file comuni`);
}

// === Copia dei file solo se tutto ok ===
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const filesToCopy = [...onlyInDir1, ...differentContent];
if (filesToCopy.length > 0) {
    rl.question('\n📥 Vuoi copiare i file diversi da dir1 a dir2? (s/n): ', (answer) => {
        if (answer.trim().toLowerCase() === 's') {
            filesToCopy.forEach(file => {
                const srcPath = path.join(dir1, file);
                const destPath = path.join(dir2, file);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.copyFileSync(srcPath, destPath);
                console.log(`${CHECK} Copiato: ${file}`);
            });
            console.log('\n✅ Copia completata.');
        } else {
            console.log('\n⏭️ Copia annullata.');
        }
        rl.close();
    });
} else {
    rl.close();
}