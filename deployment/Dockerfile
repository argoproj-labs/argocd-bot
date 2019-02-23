FROM amd64/debian

ENV CURRENT_ARGOCD_CLI_VERSION=v0.11.2

# set-up timezone
RUN echo "America/New_York" > /etc/timezone
RUN ln -fs /usr/share/zoneinfo/`cat /etc/timezone` /etc/localtime
RUN dpkg-reconfigure -f noninteractive tzdata

# install some basic packages
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get install htop apt-utils wget vim unzip git procps python python-pip curl dnsutils jq sudo -y
# install nodejs
RUN curl -sL https://deb.nodesource.com/setup_11.x | bash -
RUN apt-get update && apt-get install -y nodejs

RUN mkdir -p /usr/local/bin 
ENV PATH /usr/local/bin:$PATH

# install argocdcli
RUN wget https://github.com/argoproj/argo-cd/releases/download/${CURRENT_ARGOCD_CLI_VERSION}/argocd-linux-amd64 && mv argocd-linux-amd64 /usr/local/bin/argocd && chmod +x /usr/local/bin/argocd

# add argocd user
RUN useradd -ms /bin/bash argocd
RUN echo "argocd ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

USER argocd
RUN mkdir -p /home/argocd/argocd-bot
WORKDIR /home/argocd/argocd-bot
COPY --chown=argocd . /home/argocd/argocd-bot
RUN npm install
