import AWS from 'aws-sdk'
import { simpleParser } from 'mailparser'
import fs from 'fs'
import admzip from 'adm-zip'
import mapshaper from 'mapshaper'
import rewind from '@mapbox/geojson-rewind'

const s3 = new AWS.S3()

const timeStamp = new Date()
const date = timeStamp.toLocaleString('en-GB', { timeZone: 'US/Eastern' }).split(",")[0]
const toUpload = date.replaceAll("/", "-")

const listFiles = (folder) => fs.readdirSync(folder).forEach(file => {
  console.log(file)
});

const writeFile = (name, data) => new Promise((resolve, reject) => {
  fs.writeFile(name, data, function (err) {
    if (err) {
      console.log("Error writing file", err)
      reject(err);
    } else {
      resolve();
    }
  });
});

const upload = async (body, filename, params = {}) => {
  let defaultParams = {
    Bucket: 'isw-extracted-email-attachments-use1',
    // ACL: 'public-read',
    ContentType: 'application/json',
    CacheControl: 'max-age=3'
  }
  
  let uploadParams = {
    ...defaultParams,
    ...params,
    Key: `ukraine_control/${toUpload}/${filename}`,
    Body: body,
  }

  return s3.upload(uploadParams).promise()
}


export async function handler(event) {

  const eventBucket = event['Records'][0]['s3']['bucket']['name']
  const eventKey = event['Records'][0]['s3']['object']['key']

  const data = await s3.getObject({Bucket: eventBucket, Key: eventKey}).promise()
  const contents = data['Body'].toString("utf-8")

  const parsedEmail = await simpleParser(contents);
  const attachments = parsedEmail.attachments

  fs.mkdirSync('/tmp/attach/')
  fs.mkdirSync('/tmp/extracted/')
  console.log("writing attachments to /tmp/attach/ ...")

  for (const [i, a] of attachments.entries()) {
    await writeFile('/tmp/attach/' + i + '.zip', a.content)
    fs.mkdirSync(`/tmp/extracted/${i}/`)
    const zip = new admzip('/tmp/attach/' + i + '.zip')
    zip.extractAllTo(`/tmp/extracted/${i}/`, false)

    const fileNameBase = fs.readdirSync(`/tmp/extracted/${i}/`)[0].split('.')[0].replaceAll(" ", "_")
    console.log(`converting ${fileNameBase}.shp to geojson and topojson...`)
    await mapshaper.runCommands(`/tmp/extracted/${i}/*.shp -proj wgs84 -simplify 10% keep-shapes -clean -o format=topojson /tmp/extracted/${i}/${fileNameBase}_topo.json`)
    await mapshaper.runCommands(`/tmp/extracted/${i}/*.shp -proj wgs84 -simplify 75% keep-shapes -clean -o format=geojson /tmp/extracted/${i}/${fileNameBase}_geo_torewind.geojson`)

    console.log('Now uploading to s3...')

    const geojsonShape = fs.readFileSync(`/tmp/extracted/${i}/${fileNameBase}_geo_torewind.geojson`, 'utf8')
    const topojsonShape = fs.readFileSync(`/tmp/extracted/${i}/${fileNameBase}_topo.json`, 'utf8')
    const rewoundGeojson = JSON.stringify(rewind(JSON.parse(geojsonShape), true))

    await upload(rewoundGeojson, `geojson/${fileNameBase}.geojson`)
    await upload(topojsonShape, `topojson/${fileNameBase}_topo.json`)
  } 

  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};
