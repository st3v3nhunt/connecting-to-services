function results(req, res) {
  res.render('results');
}
function places(req, res) {
  res.render('places');
}

function findHelp(req, res) {
  res.render('find-help');
}

module.exports = {
  results,
  places,
  findHelp,
};
