<template>
  <div>
    <input type="file" @change="handleFileChange" />
    <el-button @click="handleUpload">click</el-button>
  </div>  
</template>

<script lang="ts">
  import { ElButton } from 'element-plus'
  import { ChunkInfo } from './interfaces'

  export default {
    data() {
      return {
        container: {
        }
      }
    },
    
    methods: {
      createChunks(file: File, size: number) {
        let cur = 0, arr = []
        while (cur < file.size) {
          arr.push(file.slice(cur, cur + size <= file.size ? cur + size : file.size ))
          cur += size
        }
        return arr
      },
      async uploadChunk(chunkInfo: ChunkInfo) {
        try {
          const formData = new FormData()
          formData.append('seq', chunkInfo.index)
          formData.append('file_name', chunkInfo.name)
          formData.append('file', chunkInfo.chunk)
          formData.append('upload_id', chunkInfo.uploadId)
          
          const { code } = await fetch('http://localhost:3008/upload_chunk', {
            method: 'POST',
            body: formData
          }).then(res => res.json())

        } catch (e) {
          this.$message(`error: ${e?.message}`)
        }
      },
      async handleUpload() {
        try {
          const file = this.container.file as File
          // 秒传

          // 上传请求
          const { uploadId, blockSize, blockNum } = await fetch('http://localhost:3008/upload_prepare', {
            method: 'POST',
            body: JSON.stringify({
              size: file.size,
              fileName: file.name
            })
          }).then(res => res.json())

          // 并行上传分片
          const chunkList = this.createChunks(file, blockSize)
          const chunkUploadRequests = chunkList.map((chunk, index) => {
            return this.uploadChunk({
              chunk,
              index,
              name: file.name,
              uploadId
            })
          })
          await Promise.all(chunkUploadRequests)

          // 合并
          const { msg } = await fetch('http://localhost:3008/upload_finished', {
            method: 'POST',
            body: JSON.stringify({
              uploadId
            })
          }).then(res => res.json())
          this.$message(msg)
        } catch (e) {
          
        }
      },
      handleFileChange(e) {
        const files = e.target.files
        if (!files || !files.length) return

        this.container.file = files[0]
      }
    },
  }
</script>

<style>
  #app {
    font-family: Avenir, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-align: center;
    color: #2c3e50;
    margin-top: 60px;
  }
</style>
