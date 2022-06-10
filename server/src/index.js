const http = require("http");
const path = require("path");
const fse = require("fs-extra");
const multiparty = require("multiparty");
const util = require("util");

const server = http.createServer();
clearStore(path.resolve(__dirname, "..", ".store"));
console.log(`clear store...`);

const nameMap = new Map();

const CHUNK_SIZE = 1024 * 1024 * 2;

function clearStore(target, child = false) {
  if (!fse.existsSync(target)) return;
  const files = fse.readdirSync(target);
  files.forEach((name) => {
    const newPath = path.resolve(target, name);
    if (fse.statSync(newPath).isDirectory()) {
      clearStore(newPath, true);
    } else {
      fse.removeSync(newPath);
    }
  });
  if (child) {
    fse.removeSync(target);
  }
}

function getRequestPayload(req) {
  return new Promise((resolve) => {
    let chunk = "";
    req.on("data", (data) => {
      chunk += data;
    });

    req.on("end", () => {
      resolve(JSON.parse(chunk));
    });
  });
}

function pipeStream(readPath, writeStream) {
  new Promise(resolve => {
    const readStream = fse.createReadStream(readPath)
    readStream.on('end', () => {
      fse.unlinkSync(path)
      resolve()
    })
    readStream.pipe(writeStream)
  })
}

function getRandomNum() {
  return Math.floor(Math.random() * 1e16 + 1);
}

function getChunkDir(uploadId) {
  return path.resolve(__dirname, "..", ".store", String(uploadId));
}

server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.status = 200;
    res.end();
    return;
  }

  if (req.url === "/upload_prepare") {
    const { size, fileName } = await getRequestPayload(req);
    console.log("fileName", fileName, size);
    const uploadId = getRandomNum();
    const chunkDir = getChunkDir(uploadId);
    if (!fse.existsSync(chunkDir)) {
      fse.mkdirSync(chunkDir);
    }
    const blockNum = Math.ceil(size / CHUNK_SIZE);
    nameMap.set(uploadId, { fileName, blockNum })

    res.end(
      JSON.stringify({
        code: 0,
        uploadId,
        blockSize: CHUNK_SIZE,
        blockNum,
      })
    );
  }

  if (req.url === "/upload_chunk" && req.method === "POST") {
    const multiPart = new multiparty.Form();
    console.log(`request: ${req.url}`);
    multiPart.parse(req, async (err, fields, files) => {
      if (err) {
        console.log(`upload chunk request error:`, err.message);
        return;
      }
      const [seq] = fields.seq;
      const [fileName] = fields.file_name;
      const [uploadId] = fields.upload_id;
      const [chunk] = files.file;
      const chunkDir = getChunkDir(uploadId);
      await fse.move(chunk.path, `${chunkDir}/${seq}`);

      console.log(`save ${fileName} - ${seq} success`);

      // res.writeHead(200, { 'content-type': 'text/plain' });
      // res.end(util.inspect({
      //   fields,
      //   files
      // }))
      res.end(
        JSON.stringify({
          code: 0,
          msg: "received chunk suc",
        })
      );
    });

    return;
  }

  if (req.url === "/upload_finished" && req.method === 'POST') {
    const { uploadId } = await getRequestPayload(req);
    const { fileName, blockNum } = nameMap.get(uploadId)
    const chunkDir = getChunkDir(uploadId)
    const writePath = path.resolve('./uploadFiles', fileName)
    const chunks = fse.readdirSync(chunkDir)
    await Promise.all(chunks.map(chunkIndex => pipeStream(
      path.resolve(chunkDir, chunkIndex),
      fse.createWriteStream(writePath, { start: Number(chunkIndex) * CHUNK_SIZE })
    )))
    // fse.rmdirSync(chunkDir)
    
    res.end(JSON.stringify({
      code: 0,
      msg: 'merge success'
    }))
  }
});

server.listen(3008, () => console.log("server is running on port 3008..."));
