import { startReader } from "./reader-app.mjs?v=profile-currency-header-back-4";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
