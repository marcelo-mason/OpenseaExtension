chrome.runtime.onMessage.addListener(receiveRT_MessageFromExtension);
if (document && document.readyState !== "complete") {
    window.addEventListener("load", afterWindowLoaded);
} else {
    afterWindowLoaded();
}