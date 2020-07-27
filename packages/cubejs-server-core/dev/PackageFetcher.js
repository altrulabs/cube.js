const fs = require('fs-extra');
const axios = require('axios').default;
const decompress = require('decompress');
const decompressTargz = require('decompress-targz');
const path = require('path');

class PackageFetcher {
  constructor(repo) {
    this.repo = repo;
    this.tmpFolderPath = path.join(__dirname, '__tmp__');
    
    try {
      fs.mkdirSync(this.tmpFolderPath);
    } catch (err) {
      if (err.code === 'EEXIST') {
        fs.rmdirSync(this.tmpFolderPath, { recursive: true });
        fs.mkdirSync(this.tmpFolderPath);
      } else {
        throw err;
      }
    }

    this.repoArchivePath = `${this.tmpFolderPath}/master.tar.gz`;
  }

  async manifestJSON() {
    const response = await axios.get(
      `https://api.github.com/repos/${this.repo.owner}/${this.repo.name}/contents/manifest.json`
    );

    return JSON.parse(Buffer.from(response.data.content, 'base64').toString());
  }

  async downloadRepo() {
    const url = `https://github.com/${this.repo.owner}/${this.repo.name}/archive/master.tar.gz`;
    const writer = fs.createWriteStream(this.repoArchivePath);

    const response = await axios.get(url, {
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async downloadPackages() {
    await this.downloadRepo();

    await decompress(this.repoArchivePath, this.tmpFolderPath, {
      plugins: [decompressTargz()],
    });

    const dir = fs.readdirSync(this.tmpFolderPath).find((name) => !name.endsWith('tar.gz'));

    return {
      packagesPath: path.join(this.tmpFolderPath, dir, 'packages'),
    };
  }
  
  cleanup() {
    if (fs.existsSync(this.tmpFolderPath)) {
      fs.rmdirSync(this.tmpFolderPath, { recursive: true });
    }
  }
}

module.exports = PackageFetcher;