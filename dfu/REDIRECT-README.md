# The /dfu/ path is a permanent redirect

Wound Vision moved to its own repository and its own deployment. This folder keeps the old
public link alive, because it was printed on a QR code and handed out at a conference, and a
link on a piece of paper cannot be re-issued.

`index.html` here is a plain redirect page. It uses no Vercel configuration on purpose: a
`vercel.json` rule can be lost in a settings change, whereas a file that is served is served.
It carries the query string and the fragment across, and it shows a visible link so that a
browser which blocks automatic redirection still gets the reader where they are going.

If the destination ever moves again, change `TARGET` at the top of `index.html`. Do not delete
this folder.
