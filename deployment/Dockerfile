FROM amd64/debian

ENV HELM_VERSION=v2.13.0
# this server is used to download CLI tools
ARG ARGOCD_SERVER

# set-up timezone
RUN echo "America/New_York" > /etc/timezone
RUN ln -fs /usr/share/zoneinfo/`cat /etc/timezone` /etc/localtime
RUN dpkg-reconfigure -f noninteractive tzdata

# install basic packages
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get install htop apt-utils wget vim unzip git procps python python-pip curl dnsutils jq sudo -y
# install nodejs
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt-get update && apt-get install -y nodejs

# set-up bin directory
RUN mkdir -p /usr/local/bin 
ENV PATH /usr/local/bin:$PATH

# install helm
RUN wget https://storage.googleapis.com/kubernetes-helm/helm-${HELM_VERSION}-linux-amd64.tar.gz && tar -xvf helm-*tar.gz && mv -v linux-amd64/* /usr/local/bin/ && rm -fr linux-amd64
# install argocdcli
RUN curl -k https://${ARGOCD_SERVER}/download/argocd-linux-amd64 > /usr/local/bin/argocd && chmod +x /usr/local/bin/argocd

# add argocd user
RUN useradd -ms /bin/bash argocd
RUN echo "argocd ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

USER argocd
RUN mkdir -p /home/argocd/argocd-bot
WORKDIR /home/argocd/argocd-bot

COPY --chown=argocd . /home/argocd/argocd-bot
COPY --chown=argocd deployment/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --chown=argocd deployment/diff_helper.sh /usr/local/bin/diff_helper

RUN npm install
