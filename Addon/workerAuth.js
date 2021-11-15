module.exports = (reqKey, reqValue) => {
  return (req, res, next) => {
    if (req.headers[reqKey] != reqValue) res.status(403).send("Forbidden");
    return next();
  };
};
