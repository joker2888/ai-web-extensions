// Requires CryptoJS

window.cryptoUtils = {
    digestMessage(msg) { return CryptoJS.SHA256(msg).toString(CryptoJS.enc.Hex) },
    async generateSignature({ time, msg, pkey }) { return await this.digestMessage(`${time}:${msg}:${pkey}`) }
};
