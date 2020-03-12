package main

import (
	"github.com/gin-gonic/gin"
	"io"
	"strconv"
	"time"
)

const (
	READ_PACK_SIZE = 1 * 1024
	WRITE_PACK_SIZE = 1 * 1024
)

func main() {
	r := gin.Default()
	r.POST("/upload", func(c *gin.Context) {
		body := c.Request.Body
		data := make([]byte, READ_PACK_SIZE)
		length := 0
		now := time.Now()
		for {
			n, err := body.Read(data)
			if err != nil {
				if (err != io.EOF) {
					c.JSON(400, gin.H{
						"error": err.Error(),
					})
					return;
				}
				break
			}

			length += n
		}
		duration := time.Now().UnixNano() - now.UnixNano()

		c.JSON(200, gin.H{
			"length": length,
			"duration": duration,
			"rate": float64(length) / float64(duration) * 1000 * 1000 * 1000,
		})
	})

	r.GET("/download", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		packCount, err := strconv.ParseInt(c.Query("count"), 10, 64)
		if err != nil {
			packCount = 1024 * 8
		}
		packSize, err := strconv.ParseInt(c.Query("size"), 10, 64)

		if (err != nil) {
			packSize = WRITE_PACK_SIZE
		}

		data := make([]byte, WRITE_PACK_SIZE)

		c.Header("Content-Length", strconv.FormatInt(packCount * packSize, 10))

		c.Stream(func(w io.Writer) bool {
			for i := int64(0); i < packCount; i++ {
				w.Write(data)
			}
			return false
		})
	})

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.Run(":3300")
}
