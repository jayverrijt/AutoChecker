// content.js
// Config — pas aan waar nodig
const TARGET_CHANNEL_ID = "D08EGN0HWAC";            // uit jouw link
const TARGET_SENDER_NAME = "Day-Planner-Sender";    // exact zoals in Slack UI
const DEBOUNCE_MS = 2000;                           // voorkomen van dubbele meldingen

let lastNotifiedTs = 0;

// Helper: controleer of we in het juiste kanaal zitten via URL
function isInTargetChannel() {
    try {
        const parts = location.pathname.split('/');
        // URL vorm: /client/<TEAM_ID>/<CHANNEL_ID>
        return parts.includes(TARGET_CHANNEL_ID);
    } catch (e) {
        return false;
    }
}

// Heuristiek: zoek nieuw bericht nodes die de sender-name bevatten.
// Slack's DOM verandert vaak — deze methode is best effort.
function parseMessageNode(node) {
    try {
        // Convert node to text for quick checks
        const text = node.innerText || "";
        if (!text) return null;

        // Controleer of de node de sendernaam bevat
        if (text.includes(TARGET_SENDER_NAME)) {
            // Tijdstempel: probeer een timestamp of gebruik Date.now()
            // Slack nodes hebben vaak een 'data-qa' of 'time' element; fallback op now.
            const ts = Date.now();
            return { ts, text };
        }
    } catch (e) {
        // ignore parsing errors
    }
    return null;
}

function notifyAndOpen(message) {
    const now = Date.now();
    if (now - lastNotifiedTs < DEBOUNCE_MS) return;
    lastNotifiedTs = now;

    // Systeemnotificatie (zorg dat gebruiker toestemming geeft)
    if (Notification.permission === "granted") {
        const notif = new Notification("Vrijcheck gedetecteerd", {
            body: `${TARGET_SENDER_NAME}: ${message.text.substring(0, 120)}`,
            silent: false
        });
        notif.onclick = () => {
            // open Slack kanaal (in browser tab)
            const slackUrl = `https://app.slack.com/client/${location.pathname.split('/').slice(2,3)}/${TARGET_CHANNEL_ID}`;
            window.open(slackUrl, "_blank");
            window.focus();
        };
    } else {
        console.log("Notification permission not granted.");
    }
}

// Vraag notificatie permissie bij starten (eenmalig)
if (Notification.permission === "default") {
    Notification.requestPermission().then(p => {
        console.log("Notification permission:", p);
    });
}

// Observeer DOM wijzigingen
const observer = new MutationObserver(mutations => {
    if (!isInTargetChannel()) return;

    for (const m of mutations) {
        for (const node of m.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;

            // Snelle filter: alleen nodes met tekst
            if (node.innerText && node.innerText.includes(TARGET_SENDER_NAME)) {
                const parsed = parseMessageNode(node);
                if (parsed) {
                    notifyAndOpen(parsed);
                    return; // één notificatie per batch
                }
            } else {
                // Soms is tekst diep genest; zoek kinderen
                const candidate = node.querySelector && node.querySelector("*");
                if (candidate && candidate.innerText && candidate.innerText.includes(TARGET_SENDER_NAME)) {
                    const parsed = parseMessageNode(node);
                    if (parsed) {
                        notifyAndOpen(parsed);
                        return;
                    }
                }
            }
        }
    }
});

// Start observer op body — slack rendert berichten dynamisch
observer.observe(document.body, {
    childList: true,
    subtree: true
});

console.log("Slack Day-Planner Watcher actief op dit tabblad (kanaal check:", TARGET_CHANNEL_ID, ")");
