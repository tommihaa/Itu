import "./styles.css";
import { mountGame } from "./ui/game";

const app = document.querySelector<HTMLElement>("#app")!;
mountGame(app);
