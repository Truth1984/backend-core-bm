const u = require("awadau");
const un = require("./core");
const express = require("express");
const bodyParser = require("body-parser");
const tl2 = require("tl2");
const loggerHandle = require("./Addon/loggerHandle");
const secretHandle = require("./Addon/secretHandle");
const envHandle = require("./Addon/envHandle");
const mwHandle = require("./Addon/middleware");
const workerAuth = require("./Addon/workerAuth");
require("./typedef");

module.exports = class Framework {
  /**
   * @param {CoreConfig} config
   *
   * directories define path for different sections
   *
   */
  constructor(config = {}) {
    this.express = express;
    this.app = express();
    this.app.use(bodyParser.json({ type: "application/json" }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

    config = u.mapMergeDeep(
      {
        master: true,
        dev: "dev",
        listen: process.env.PORT || 8080,
        envAddition: [],
        perform: {
          "pre-process": [],
          process: [],
          "post-process": [],
          "pre-terminate": [],
        },
        logger: {
          devOverride: true,
          type: "on",
          bunyan: {
            name: "nodeApp",
            baseLevel: "",
          },
        },
        directories: {
          logger: un.filePathNormalize(__dirname, "../../Logger"),
          secret: un.filePathNormalize(__dirname, "../../Personal"),
        },
        router: {},
        oauth: {
          enable: false,
          reqKey: "workerauth",
          reqValue: un.uuid(),
        },
        secret: {
          filename: "config.js",
          keys: ["master", "listen", "oauth"],
          additional: {},
        },
      },
      config
    );
    this.config = config;

    /**
     * @type {{trace: (msg: any) => any, debug: (msg: any) => any, info: (msg: any) => any, warn: (msg: any) => any, error: (msg: any) => any, fatal: (msg: any) => any}}
     */
    this.logger = loggerHandle(this.config);
    this.runtime = {
      scheduler: {},
    };
  }

  addSecretKey(map) {
    this.config.secret.additional = u.mapMergeDeep(this.config.secret.additional, map);
  }

  /**
   *
   * @typedef {import('express').Request} req
   * @typedef {import('express').Response} res
   * @typedef {import('express').NextFunction} next
   *
   * @param {string} path
   * @param {(body,req:req,res:res,next:next)=>{}} callback
   */
  router(path, callback) {
    this.config.router[path] = callback;
  }

  listen(port) {
    this.config.listen = port;
  }

  /**
   *
   * @param {"process" | "post-process" | "pre-terminate"} level
   *
   * **process** : router and logic
   *
   * **post-process** : post configuration
   *
   * **pre-terminate**: only run once before termination
   *
   * @param {*} operation
   */
  perform(level, operation) {
    this.config.perform[level].push(operation);
  }

  run() {
    let task = new tl2();
    task.add("initialization", async () => {
      this.config = await secretHandle(this.config);
      this.config = await envHandle(this.config);
      this.logger = await loggerHandle(this.config);
      this.app.get("/health-check", (req, res) => res.status(200).send("OK"));
    });

    task.add("process", async () => {
      for (let i of this.config.perform["process"]) await i(this);
    });

    task.add("requests", async () => {
      if (this.config.oauth.enable) this.app.use(workerAuth(this.config.oauth.reqKey, this.config.oauth.reqValue));
      for (let i in this.config.router) this.app.all(i, mwHandle(this.logger, this.config.router[i]));

      this.app.use((error, req, res, next) => {
        if (!error) return;
        this.logger.error(error);
        if (!res.headersSent) res.status(420).send(error);
      });
    });

    task.add("post-process", async () => {
      for (let i of this.config.perform["post-process"]) await i(this);
    });

    task.add("listening", async () => {
      let infomsg = `Listening on port ${this.config.listen}`;
      if (this.config.oauth.enable)
        infomsg += ` oauth key: ${this.config.oauth.reqKey} value: ${this.config.oauth.reqValue}`;
      this.server = this.app.listen(this.config.listen, () => this.logger.info(infomsg));
    });

    task.add("pre-terminate", () => {
      process.stdin.resume(); //so the program will not close instantly
      process.on("exit", () => this.config.perform["pre-terminate"].map((i) => i(this))); //do something when app is closing
      process.on("SIGINT", () => process.exit()); //catches ctrl+c event
      // catches "kill pid" (for example: nodemon restart)
      process.on("SIGUSR1", () => process.exit());
      process.on("SIGUSR2", () => process.exit());

      //catches uncaught exceptions
      process.on("uncaughtException", (error, origin) => {
        this.logger.fatal({ error, origin });
        process.exit();
      });
    });
    return task.runAuto();
  }
};
