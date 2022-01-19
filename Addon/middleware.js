const u = require("awadau");

module.exports = (logger, callback) => {
  let throwError = (e, req) =>
    logger.error({
      status: 500,
      error: e.toString(),
      path: req.originalUrl,
      param: req.body,
      stack: e.stack,
    });

  let send = (status, result, res, next) => {
    if (!res.headersSent) res.status(status).send(result);
  };

  return (req, res, next) => {
    try {
      Promise.resolve(callback(req.body, req, res, next))
        .then((data) => {
          if (typeof data == "number") data += "";
          return send(200, data, res);
        })
        .catch((e) => {
          if (u.typeCheck(e, "err")) {
            throwError(e, req);
            return send(500, e.toString(), res);
          }
          if (typeof e == "number") e += "";
          return send(400, e, res);
        });
    } catch (e) {
      throwError(e, req);
      return send(500, e.toString(), res);
    }
  };
};
