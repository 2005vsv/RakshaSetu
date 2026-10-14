const router = require("express").Router();
const ctrl = require("../controllers/alertsController");
const auth = require("../middleware/auth");

router.get("/", auth, ctrl.listAlerts);
router.post("/", auth, ctrl.createAlert);
router.put("/:id/assign", auth, ctrl.assignAlert);

module.exports = router;
