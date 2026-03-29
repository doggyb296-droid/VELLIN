import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFile), '..');
const androidDir = resolve(repoRoot, 'android');

const isWindows = process.platform === 'win32';

const findJavaHome = () => {
  const candidates = isWindows
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        'C:\\Program Files\\Android\\Android Studio\\jre',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-21',
        'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.18.8-hotspot',
      ]
    : [
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        '/Applications/Android Studio.app/Contents/jbr',
        '/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home',
        '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home',
      ];

  const preferredStudioJava = candidates.find((candidate) => existsSync(candidate));
  if (preferredStudioJava) {
    return preferredStudioJava;
  }

  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  return null;
};

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Missing Gradle task. Example: node scripts/run-android-gradle.mjs assembleDebug');
  process.exit(1);
}

const javaHome = findJavaHome();
const gradleUserHome = resolve(repoRoot, '.gradle');
const androidUserHome = resolve(repoRoot, '.android');
const gradleExecutable = isWindows ? 'gradlew.bat' : './gradlew';

const env = { ...process.env, GRADLE_USER_HOME: gradleUserHome };

mkdirSync(gradleUserHome, { recursive: true });
mkdirSync(androidUserHome, { recursive: true });
env.ANDROID_USER_HOME = androidUserHome;

if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = isWindows
    ? `${resolve(javaHome, 'bin')};${env.PATH ?? ''}`
    : `${resolve(javaHome, 'bin')}:${env.PATH ?? ''}`;
}

const result = spawnSync(gradleExecutable, args, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: isWindows,
});

process.exit(result.status ?? 1);
