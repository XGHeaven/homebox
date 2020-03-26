package main

import (
	"github.com/gin-gonic/gin"
	"io"
	"strconv"
	"time"
)

var (
	ENV string
)

const (
	READ_PACK_SIZE  = 1 * 1024
	WRITE_PACK_SIZE = 1 * 1024 * 1024
)

func main() {
	isProd := ENV == "production"
	r := gin.Default()

	if isProd {
		r.LoadHTMLGlob("./static/*.html")
		r.Static("/static", "./static")

		r.GET("/", func(ctx *gin.Context) {
			ctx.HTML(200, "index.html", struct{}{})
		})
	}

	r.OPTIONS("/upload", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
	})

	r.POST("/upload", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		body := c.Request.Body
		data := make([]byte, READ_PACK_SIZE)
		length := 0
		now := time.Now()
		for {
			n, err := body.Read(data)
			length += n
			if err != nil {
				if err != io.EOF {
					c.JSON(400, gin.H{
						"error": err.Error(),
					})
					return
				}
				break
			}
		}
		duration := time.Now().UnixNano() - now.UnixNano()

		c.JSON(200, gin.H{
			"length":   length,
			"duration": float64(duration) / 1000 / 1000,
			"rate":     float64(length) / float64(duration) * 1000 * 1000 * 1000,
		})
	})

	r.GET("/download", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		c.Header("Content-Disposition", "attachment; filename=random.dat")
		c.Header("Content-Transfer-Encoding", "binary")
		packCount, err := strconv.ParseInt(c.Query("count"), 10, 64)
		if err != nil {
			packCount = 8
		}
		packSize, err := strconv.ParseInt(c.Query("size"), 10, 64)

		if err != nil {
			packSize = WRITE_PACK_SIZE
		}

		data := make([]byte, WRITE_PACK_SIZE)

		c.Header("Content-Length", strconv.FormatInt(packCount*packSize, 10))

		i := packCount
		c.Stream(func(w io.Writer) bool {
			w.Write(data)
			i -= 1
			return i > 0
		})
	})

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"message": "pong",
		})
	})

	r.Run(":3300")
}
