# webOS IPTV Player

A light IPTV player for webOS TVs. It loads an M3U playlist and plays the channels with the TV's own video player. You install it through Developer Mode. You do not need root.

This tutorial shows the full procedure: from Developer Mode on the TV to the installed app.

**Tested on:** an EyePlus webOS Hub TV (board `KF23F_DVB_AJ`, firmware 13.48.25, about webOS 23, 1.35 GB RAM). It should work on LG webOS TVs too, but I did not test them.

## Features

- Loads an M3U / M3U8 playlist from a URL.
- Shows a channel list with logos and groups (`group-title`).
- Uses the TV's own player for HLS (`.m3u8`) and MPEG-TS streams. If the native player fails on an HLS stream, the app tries [hls.js](https://github.com/video-dev/hls.js) one time.
- Remembers the playlist and the last channel.
- Uses only the remote control.
- Stays light: about 13 MB of RAM with nothing playing. It draws only the visible rows, so large playlists are fast.
- No ads, no tracking, no network use other than your playlist and your streams.

## What you need

- A webOS TV and a computer on the same Wi-Fi network.
- An LG account (free). Developer Mode uses it.
- [Node.js](https://nodejs.org/) on the computer.
- An M3U playlist URL. Use only playlists that you have the right to watch.

## 1. Turn on Developer Mode on the TV

1. On the TV, open the app store and search for **Developer Mode**.
2. Install the Developer Mode app and open it.
3. Sign in with your LG account.
4. Set **Dev Mode Status** to on. The TV restarts.
5. Open the Developer Mode app again.
6. Set **Key Server** to on.
7. Write down the **IP address** and the **Passphrase** that the app shows.

If your TV app store does not have the Developer Mode app, this procedure does not work on your TV.

## 2. Install the webOS CLI on the computer

```bash
npm install -g @webos-tools/cli
```

## 3. Connect the computer to the TV

1. Add the TV as a device. Replace `192.168.1.50` with the IP address of your TV.

   ```bash
   ares-setup-device -a mytv -i "host=192.168.1.50" -i "port=9922" -i "username=prisoner"
   ```

2. Get the SSH key from the TV. Type the passphrase from the Developer Mode app when the prompt asks. The passphrase is case-sensitive.

   ```bash
   ares-novacom --device mytv --getkey
   ```

3. Check the connection. The command shows the model and the firmware.

   ```bash
   ares-device -i -d mytv
   ```

## 4. Check the TV resources (optional)

Low-cost webOS TVs often have little RAM. This command shows the CPU and the RAM use:

```bash
ares-device -r -d mytv
```

If the `available` memory is low (for example, less than 300 MB), close other apps before you watch IPTV.

## 5. Install the app

1. Get the code.

   ```bash
   git clone https://github.com/r1th1k/webos-iptv-player.git
   ```

2. Go into the folder.

   ```bash
   cd webos-iptv-player
   ```

3. Package the app. This makes an `.ipk` file in `dist/`.

   ```bash
   ares-package app -o dist
   ```

4. Install the app on the TV.

   ```bash
   ares-install -d mytv dist/com.rithik.iptv_1.0.0_all.ipk
   ```

5. Start the app. You can also start it from the TV home screen. Its name is **IPTV**.

   ```bash
   ares-launch -d mytv com.rithik.iptv
   ```

## 6. Use the app

1. On the setup screen, select the URL field. The TV keyboard opens.
2. Type your M3U playlist URL and press OK.
3. Select a channel and press OK.

| Screen | Key | Action |
|---|---|---|
| Setup | OK | Load the playlist URL |
| Channel list | Up / Down | Select a channel |
| Channel list | CH+ / CH- | Move 10 channels |
| Channel list | Left / Right | Change the group |
| Channel list | OK | Play the channel |
| Channel list | Back | Hide the list (or exit if nothing plays) |
| Playback | Up / Down, CH+ / CH- | Previous / next channel |
| Playback | OK, Left, Right, Back | Show the channel list |
| Any | Red | Change the playlist URL |

## 7. Keep the app installed

> **Caution:** The Developer Mode session expires after about 50 hours. When it expires, the TV removes the app.

1. Open the Developer Mode app every one or two days.
2. Select **Extend**. The timer goes back to the full time.

A restart of the TV does not remove the app. Only the expired timer removes it. If the TV removes it, do step 5 again.

## Troubleshooting

| Problem | Solution |
|---|---|
| `ares` cannot connect after a TV restart | The router gave the TV a new IP address. Read the new address in the Developer Mode app, then run `ares-setup-device -m mytv -i "host=NEW_IP"`. To stop this, give the TV a fixed IP address in your router (DHCP reservation). |
| `All configured authentication methods failed` | The key fetch did not finish. Run `ares-novacom --device mytv --getkey` again and type the passphrase. |
| "Could not load the playlist" | Open the URL on the computer to check it. The URL must start with `http://` or `https://`. |
| "Cannot play this channel" | The stream is offline, or it needs a special header (for example a user agent). Try the stream in VLC on the computer. |
| The TV is slow | The TV has too little free RAM. Close other apps, turn off Quick Start+, and power the TV fully off and on. |

### What Developer Mode cannot do

On some webOS TVs (for example webOS Hub TVs from other brands), the Developer Mode shell is limited. `luna-send` is not permitted, and you cannot list or remove the system apps. You can install and run your own web apps only. You cannot install native apps such as VLC.

## Development

| Task | Command |
|---|---|
| Run the parser tests | `node --test test/m3u.test.js` |
| Run JavaScript in the app on the TV | `TV_DEVICE=mytv node tools/tv-eval.js "<expression>"` |
| Make the icons again | `python3 tools/make-icons.py app` |

To test without a playlist server, start the app with a playlist in a `data:` URL:

```bash
ares-launch -d mytv com.rithik.iptv -p '{"playlist":"data:audio/x-mpegurl;base64,<BASE64_OF_M3U>"}'
```

### Files

| Path | Content |
|---|---|
| `app/appinfo.json` | The webOS app manifest |
| `app/index.html`, `app/style.css` | The screens (1920 x 1080) |
| `app/app.js` | The remote keys, the channel list, and playback |
| `app/m3u.js` | The M3U parser |
| `app/lib/hls.light.min.js` | hls.js 1.5.20 (Apache-2.0, see `app/lib/hls.LICENSE`) |
| `tools/tv-eval.js` | Runs JavaScript in the app on the TV through `ares-inspect` |
| `tools/make-icons.py` | Makes the app icons |
| `test/m3u.test.js` | The parser tests |

## License

MIT, see [LICENSE](LICENSE). The bundled hls.js is Apache-2.0, see `app/lib/hls.LICENSE`.
