const u = require("awadau");
const uuid = require("uuid");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const fsp = fs.promises;
const fse = require("fs-extra");
const iconv = require("iconv-lite");
const paths = require("path");
const download = require("download");
const archiver = require("archiver");
const readline = require("readline");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const readdir = require("readdirp");
const htmlEntities = new (require("html-entities").Html5Entities)();

var un = {};

un.uuid = (v4 = true) => (v4 ? uuid.v4() : uuid.v1());

/**
 * using `bcryptjs`
 * @return {Promise<String>}
 */
un.passwordEncrypt = (plainText) => bcrypt.hash(plainText, 10);

/**
 * using `bcryptjs`
 * @return {Promise<Boolean>}
 */
un.passwordCheck = (plainText, hash) => bcrypt.compare(plainText, hash);

/**
 * @return {Buffer}
 */
un.textEncrypt = (text, secret) => {
  let key = crypto.createHash("sha256").update(String(secret)).digest("base64").substr(0, 32);
  let algorithm = "aes-256-ctr";
  let iv = crypto.randomBytes(16);
  let cipher = crypto.createCipheriv(algorithm, key, iv);
  return Buffer.concat([iv, cipher.update(Buffer.from(text)), cipher.final()]).toString("binary");
};

/**
 * @return {string}
 */
un.textDecrypt = (encrypted, secret) => {
  let key = crypto.createHash("sha256").update(String(secret)).digest("base64").substr(0, 32);
  let algorithm = "aes-256-ctr";
  encrypted = Buffer.from(encrypted, "binary");
  let iv = encrypted.slice(0, 16);
  encrypted = encrypted.slice(16);
  let decipher = crypto.createDecipheriv(algorithm, key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
};

un.textEncryptBase64 = (text, encrypting = true) => {
  return encrypting ? Buffer.from(text).toString("base64") : Buffer.from(text, "base64").toString();
};

/**
 * normalize path, also replace ~ with $home
 */
un.filePathNormalize = (...path) =>
  u.stringReplace(paths.normalize(paths.join(...path)), { "^~": process.env.HOME, "\\\\\\\\": "/", "\\\\": "/" });

un.filePathFull = (...path) => paths.resolve(...path);

un.filePathAnalyze = (...path) => {
  path = un.filePathNormalize(...path);
  let full = paths.resolve(path);
  return {
    dirname: paths.dirname(path),
    current: path,
    full: {
      current: full,
      dirname: paths.dirname(full),
      basename: paths.basename(full),
    },
    basename: paths.basename(path),
    ext: paths.extname(path),
  };
};

un.fileExist = (path) => {
  path = un.filePathNormalize(path);
  return fs.existsSync(path);
};

/**
 * @return {Boolean}
 */
un.fileIsDir = (path) => {
  path = un.filePathNormalize(path);
  return fs.existsSync(path) && fs.lstatSync(path).isDirectory();
};

un.filels = async (path, fullPath = false) => {
  path = un.filePathNormalize(path);
  return fsp.readdir(path).then((data) => {
    if (fullPath) return data.map((value) => paths.resolve(path, value));
    return data;
  });
};

un.fileSize = async (path) => {
  path = un.filePathNormalize(path);
  return fsp.stat(path).then((data) => data.size / 1e6);
};

un.fileMkdir = (path, recursive = true) => {
  path = un.filePathNormalize(path);
  if (fs.existsSync(path)) return Promise.resolve(true);
  return fsp.mkdir(path, { recursive });
};

un.fileMkdirTouch = (path, recursive = true) => {
  return un.fileMkdir(paths.dirname(path), recursive).then((bool) => {
    if (bool !== true) return un.fileWrite("", false, path);
  });
};

un.fileMove = async (source, target, mkdir = true, overwrite = true) => {
  source = un.filePathNormalize(source);
  target = un.filePathNormalize(target);
  if (mkdir) fse.mkdirpSync(paths.dirname(target));
  return fse.moveSync(source, target, { overwrite });
};

/**
 * 
 * @param {string} path 
 * @param {{root?: string;
    fileFilter?: string | string[] | ((entry: EntryInfo) => boolean);
    directoryFilter?: string | string[] | ((entry: EntryInfo) => boolean);
    type?: 'files' | 'directories' | 'files_directories' | 'all';
    lstat?: boolean;
    depth?: number;
    alwaysStat?: boolean;}} option 
 */
un.fileReaddir = async (path, option) => {
  return readdir.promise(un.filePathNormalize(path), option);
};

un.fileLatestDir = (path) => {
  return un.fileIsDir(path) ? path : paths.dirname(path);
};

un.fileWrite = async (content, appendOrNot = false, path, encode = "utf8") => {
  path = un.filePathNormalize(path);
  return un
    .fileMkdir(paths.dirname(path))
    .then(() =>
      Buffer.isBuffer(content)
        ? fsp.writeFile(path, content, { flag: appendOrNot ? "a+" : "w+", encoding: "binary" })
        : fsp.writeFile(path, iconv.encode(content, encode), { flag: appendOrNot ? "a+" : "w+" })
    );
};

un.fileWriteSync = (content, appendOrNot = false, path, encode = "utf8") => {
  path = un.filePathNormalize(path);
  un.fileMkdir(paths.dirname(path));
  return Buffer.isBuffer(content)
    ? fs.writeFileSync(path, content, { flag: appendOrNot ? "a+" : "w+", encoding: "binary" })
    : fs.writeFileSync(path, iconv.encode(content, encode), {
        flag: appendOrNot ? "a+" : "w+",
      });
};

un.fileRead = async (path, encode = "utf8") => {
  path = un.filePathNormalize(path);
  return fsp.readFile(path, encode);
};

un.fileReadSync = (path, encode = "utf8") => {
  path = un.filePathNormalize(path);
  return fs.readFileSync(path, encode).toString();
};

/**
 * @return {Promise<Buffer>}
 */
un.fileReadBuffer = async (path) => {
  path = un.filePathNormalize(path);
  return fsp.readFile(path, "binary");
};

un.fileDelete = async (path, trash = false) => {
  path = un.filePathNormalize(path);
  if (trash) return un.cmd(`trash ${path}`);
  return fsp.unlink(path);
};

/**
 *
 * @typedef {import('download').DownloadOptions} DownloadOptions
 * @param {string} url
 * @param {string} outputPath
 * @param {DownloadOptions} opt
 * @return {Promise<{}>} headers
 */
un.fileDownload = async (url, outputPath, opt = {}) => {
  url = u.url(url);
  outputPath = un.filePathNormalize(outputPath);
  let dobj = download(url, undefined, opt);
  let headers;
  dobj.on("response", (res) => (headers = Promise.resolve(res.headers)));
  let stream = dobj.pipe(fs.createWriteStream(outputPath));
  return new Promise((resolve, reject) => {
    stream.on("close", () => resolve(headers));
    stream.on("error", (e) => reject(e));
  });
};

un.fileStat = (path) => fs.statSync(un.filePathNormalize(path));

un.cmd = async (scripts) => {
  return un.cmdSync(scripts);
};

un.cmdSync = (scripts) => {
  let cmdarray = scripts.split(" ");
  return spawnSync(cmdarray.shift(), cmdarray, {
    shell: true,
    stdio: "pipe",
    encoding: "utf-8",
    env: process.env,
  }).stdout;
};

/**
 * @param path can be [path]
 * @param outputPath file better end up with .zip
 * @return {Promise<String>} filedest
 */
un.fileZip = (path, outputPath) => {
  if (u.typeCheck(path, "arr")) path = path.map(un.filePathNormalize);
  else path = un.filePathNormalize(path);
  outputPath = un.filePathNormalize(outputPath);

  let archive = archiver("zip", { zlib: { level: 9 } });
  let stream = fs.createWriteStream(outputPath);
  return new Promise((resolve, reject) => {
    if (u.typeCheck(path, "arr")) path.map((i) => archive.append(i, { name: paths.basename(i) }));
    else un.fileIsDir(path) ? archive.directory(path, false) : archive.append(path, { name: paths.basename(path) });
    archive.on("error", reject).pipe(stream);
    stream.on("close", () => resolve());
    archive.finalize();
  });
};

/**
 * @param {(line, outputStream:{write:()=>{}})=>{}} inputCallback
 */
un.fileProcess = (inputPath, outputPath, inputCallback) => {
  inputPath = un.filePathNormalize(inputPath);
  outputPath = un.filePathNormalize(outputPath);
  let readStream = fs.createReadStream(inputPath);
  fs.writeFileSync(outputPath, "");
  let outputStream = fs.createWriteStream(outputPath, { flags: "a" });
  outputStream.readable = true;
  outputStream.writable = true;
  let rl = readline.createInterface(readStream, outputStream);
  let perform = async () => {
    for await (const line of rl) {
      await inputCallback(line, outputStream);
    }
  };
  return perform().then(() => new Promise((resolve) => outputStream.end(() => resolve())));
};

un.escapeHtml = (content) => htmlEntities.encode(content);

un.unescapeHtml = (content) => htmlEntities.decode(content);

module.exports = un;
