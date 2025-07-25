curl -X POST http://localhost:3000/api/documents/upload \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODgzZDU1NDNkYTc1YzdlODA2OWI2M2UiLCJpYXQiOjE3NTM0NzAzNDEsImV4cCI6MTc1NDA3NTE0MX0.OQzYuGRgtrm_nLxD_ukwKiasByEBYCM__aIEAh9P5YQ" \
  -F "document=@tests/example.pdf" \
  -F "title=测试文档" \
  -F "tags=测试,PDF"