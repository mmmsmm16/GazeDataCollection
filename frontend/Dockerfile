# Python 3.10とNode.jsを含むベースイメージを使用
FROM nikolaik/python-nodejs:python3.10-nodejs14

# 必要な依存関係をインストール
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libxtst6 \
    libxss1 \
    libnss3 \
    libasound2 \
    libxshmfence1 \
    libgbm1 \
    libegl1 \
    libusb-1.0-0 \
    libusb-1.0-0-dev \
    usbutils \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install pyusb

# 非rootユーザーを作成し、必要なグループに追加
RUN useradd -m appuser && \
    usermod -aG plugdev,video appuser

# npmのキャッシュディレクトリを設定
RUN mkdir -p /tmp/.npm && \
    chown -R appuser:appuser /tmp/.npm && \
    npm config set cache /tmp/.npm --global

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonをコピー
COPY package*.json ./

# npm installを実行し、その後権限を変更
RUN npm install && \
    npm install --save-dev electron && \
    npm install -g react-scripts && \
    chown -R appuser:appuser /app
# アプリケーションのソースコードをコピー
COPY . .

# 非rootユーザーに切り替え
USER appuser

# コンテナ起動時にシェルを起動
CMD ["/bin/bash"]
