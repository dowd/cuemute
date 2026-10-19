# Install and start

cuemute is one file. It holds everything it needs, so the machine that runs it needs nothing else installed.

## Download cuemute

1. Open the [cuemute releases page](https://github.com/dowd/cuemute/releases) and pick the latest release.
2. Download the file for your machine:

    | Machine | File |
    |---|---|
    | Mac with Apple silicon (M1 and later) | `cuemute-<version>-darwin-arm64.tar.gz` |
    | Mac with an Intel processor | `cuemute-<version>-darwin-x64.tar.gz` |
    | Windows | `cuemute-<version>-win-x64.zip` |
    | Raspberry Pi (64-bit) | `cuemute-<version>-linux-arm64.tar.gz` |
    | Linux PC | `cuemute-<version>-linux-x64.tar.gz` |

3. Double-click the downloaded file to unpack it. You get a file called `cuemute` (`cuemute.exe` on Windows).
4. Move the file to a folder of your choice, for example `Applications` or your home folder.

To find which Mac you have, open the Apple menu and select **About This Mac**. The **Chip** line says Apple M1 or later, or **Processor** says Intel.

## Start cuemute on a Mac

1. Open **Terminal**.
2. Type `cd`, a space, then drag the folder that holds `cuemute` into the Terminal window. Press Return.
3. Start cuemute:

    ```sh
    ./cuemute
    ```

4. Open <http://127.0.0.1:4000> in a web browser.

cuemute prints where it keeps its settings and shows, then the address to open. Leave the Terminal window open while you use cuemute. To stop cuemute, press Control-C in that window.

The first time you start a downloaded copy, macOS blocks it, because the file isn't signed by a registered Apple developer. To allow it:

1. Open **System Settings > Privacy & Security**.
2. Scroll down to the message about `cuemute`, and select **Open Anyway**.
3. Start cuemute again, and confirm.

macOS remembers this for that copy of the file.

## Start cuemute on Windows or Linux

On Windows, double-click `cuemute.exe`. If Windows SmartScreen stops it, select **More info**, then **Run anyway**.

On Linux or a Raspberry Pi, run `./cuemute` in a terminal.

In both cases, open <http://127.0.0.1:4000> in a web browser on the same machine.

## Use cuemute from an iPad or another computer

By default cuemute only accepts connections from the machine it runs on. To use it from an iPad, a second laptop or Companion on another machine, make it listen on the show network.

1. Find the address of the show machine on the show network. On a Mac, open **System Settings > Network**, select the network, and look for **IP address**, for example `192.168.1.10`.
2. Make a settings file called `cuemute.json` with this address. See [Settings](settings.md) for where the file goes.

    ```json
    {
      "host": "192.168.1.10"
    }
    ```

3. Restart cuemute.
4. On the iPad, open `http://192.168.1.10:4000`.

Use the address on the desk network, not the venue Wi-Fi. cuemute has no password, so anyone who can reach that address can run the show.

## Where cuemute keeps your shows

cuemute keeps its settings and shows in a folder for your user:

| Machine | Folder |
|---|---|
| Mac | `~/Library/Application Support/cuemute` |
| Windows | `%APPDATA%\cuemute` |
| Linux | `~/.config/cuemute` |

Your shows are in the `shows` folder inside it. To keep them somewhere else, such as a Dropbox folder, see [Settings](settings.md).

To open the folder on a Mac, select **Go > Go to Folder** in Finder and paste the path.

## Update cuemute

Download the new release and replace the old `cuemute` file with the new one. Your settings and shows stay where they are.
