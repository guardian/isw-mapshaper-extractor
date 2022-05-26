zip -r ./isw-mapshaper-extractor-archive.zip ./node_modules
zip -g isw-mapshaper-extractor-archive.zip index.js
zip -g isw-mapshaper-extractor-archive.zip package.json
zip -g isw-mapshaper-extractor-archive.zip package-lock.json

aws s3 cp ./isw-mapshaper-extractor-archive.zip s3://gdn-cdn/visuals-lambda-packages/isw-mapshaper-extractor-packages/
aws lambda update-function-code --function-name isw-mapshaper-extractor --s3-bucket gdn-cdn --s3-key visuals-lambda-packages/isw-mapshaper-extractor-packages/isw-mapshaper-extractor-archive.zip --region us-east-1
rm ./isw-mapshaper-extractor-archive.zip